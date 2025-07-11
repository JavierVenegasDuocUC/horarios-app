// Variables globales
let horarios = JSON.parse(localStorage.getItem('horarios')) || {};
let fechaMostrada = new Date();
let horarioEditando = null;
let actividadesTemporales = [];
let bloqueActualIndex = null;
let tabActual = 'hoy';
let confirmacionCallback = null;
let fechaSeleccionada = new Date();

// Definición de bloques horarios (actualizado según solicitud)
const bloquesHorarios = [
    { inicio: "00:00", fin: "03:00", nombre: "Madrugada" },
    { inicio: "03:00", fin: "06:00", nombre: "Madrugada" },
    { inicio: "07:00", fin: "11:00", nombre: "Mañana" },
    { inicio: "11:00", fin: "13:00", nombre: "Mediodía" },
    { inicio: "13:00", fin: "16:00", nombre: "Tarde" },
    { inicio: "16:00", fin: "19:00", nombre: "Tarde-Noche" },
    { inicio: "19:00", fin: "21:00", nombre: "Noche" },
    { inicio: "21:00", fin: "00:00", nombre: "Noche-Madrugada" }
];

// Estados personalizados
const ESTADOS = {
    'POR TRABAJAR': { color: 'bg-por-trabajar', texto: 'POR TRABAJAR' },
    'PENDIENTE': { color: 'bg-pendiente', texto: 'PENDIENTE' },
    'TRABAJANDO': { color: 'bg-trabajando', texto: 'TRABAJANDO' },
    'TERMINADO': { color: 'bg-terminado', texto: 'TERMINADO' },
    'CANCELADO': { color: 'bg-cancelado', texto: 'CANCELADO' },
    'LIBRE': { color: 'bg-libre', texto: 'LIBRE' },
    'LICENCIA': { color: 'bg-licencia', texto: 'LICENCIA' }
};

// Datos de trabajadores (MODIFICADO según solicitud)
const trabajadores = [
    { nombre: "Franklin Mendoza", area: "Jefatura SOC" },
    { nombre: "Johandry Bellorin", area: "Operador SOC" },
    { nombre: "Luis Reyes", area: "Operador SOC" },
    { nombre: "Javier Venegas", area: "Operador SOC" },
    { nombre: "Sergio Larenas", area: "Jefatura de Servicios" },
    { nombre: "Cristobal Orrego", area: "Agente de Servicios" },
    { nombre: "Gabriel Fuentes", area: "Agente de Servicios" },
    { nombre: "Giovanni Caceres", area: "Agente de Servicios" },
    { nombre: "Andrea Gavilán", area: "Secretaría" },
    { nombre: "Claudio Giaconi", area: "Gerencia ITEX" }
];

// Función para actualizar el reloj en tiempo real
function actualizarReloj() {
    const datetimeDisplay = document.getElementById("datetime-actual");
    if (!datetimeDisplay) return;

    const ahora = new Date();

    // Formatear la fecha en español con día en mayúsculas
    const opcionesFecha = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };

    const opcionesHora = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    let fechaFormateada = ahora.toLocaleDateString("es-CL", opcionesFecha);
    // Convertir el día a mayúsculas
    fechaFormateada = fechaFormateada.replace(/(^\w|\s\w)/g, m => m.toUpperCase());

    const horaFormateada = ahora.toLocaleTimeString("es-CL", opcionesHora);

    datetimeDisplay.textContent = `${fechaFormateada} - ${horaFormateada}`;

    // Actualizar el índice del bloque actual
    const horaActual = ahora.getHours() + ":" + (ahora.getMinutes() < 10 ? "0" : "") + ahora.getMinutes();
    let nuevoBloqueActual = null;

    bloquesHorarios.forEach((bloque, index) => {
        if (horaActual >= bloque.inicio && horaActual < bloque.fin) {
            nuevoBloqueActual = index;
        }
    });

    if (nuevoBloqueActual !== bloqueActualIndex) {
        bloqueActualIndex = nuevoBloqueActual;
        actualizarVistas();
    }
}

// Función mejorada para buscar actividades que se superpongan con un bloque horario
function buscarActividades(trabajador, fecha, bloque) {
    if (!horarios[trabajador]) return [];

    const bloqueInfo = bloquesHorarios[bloque];
    const actividadesEnBloque = [];
    const fechaBloque = new Date(fecha);
    const inicioBloque = new Date(`${fecha}T${bloqueInfo.inicio}`);
    const finBloque = new Date(`${fecha}T${bloqueInfo.fin}`);

    // Ajustar para bloques que pasan la medianoche
    if (bloqueInfo.fin < bloqueInfo.inicio) {
        finBloque.setDate(finBloque.getDate() + 1);
    }

    for (const id in horarios[trabajador]) {
        const actividad = horarios[trabajador][id];
        const inicioActividad = new Date(`${actividad.fecha_inicio}T${actividad.hora_inicio}`);
        const finActividad = new Date(`${actividad.fecha_fin}T${actividad.hora_fin}`);

        // Ajustar para actividades que cruzan medianoche
        if (actividad.hora_fin < actividad.hora_inicio) {
            finActividad.setDate(finActividad.getDate() + 1);
        }

        // Verificar superposición entre el bloque y la actividad
        const actividadEnBloque = (
            (inicioActividad < finBloque && finActividad > inicioBloque) || // Superposición normal
            (actividad.fecha_inicio === fecha && actividad.fecha_fin === fecha) || // Mismo día
            (actividad.fecha_inicio === fecha && actividad.fecha_fin !== fecha && actividad.hora_fin < actividad.hora_inicio) || // Cruce de medianoche
            (actividad.fecha_inicio !== actividad.fecha_fin && ( // Actividades multi-día
                (fecha > actividad.fecha_inicio && fecha < actividad.fecha_fin) || // Día intermedio
                (fecha === actividad.fecha_inicio && finActividad > inicioBloque) || // Primer día
                (fecha === actividad.fecha_fin && inicioActividad < finBloque) // Último día
            ))
        );

        if (actividadEnBloque) {
            actividadesEnBloque.push(actividad);
        }
    }

    return actividadesEnBloque;
}

// Función para actualizar ambas vistas
function actualizarVistas() {
    actualizarEstadosHorarios();
    if (tabActual === 'hoy') {
        generarTablaHoy();
    } else {
        generarTablaSemanal();
    }
}

// Función para generar la tabla de horarios para hoy con bloques
function generarTablaHoy() {
    const tabla = document.getElementById("tabla-hoy");
    if (!tabla) return;

    tabla.innerHTML = "";

    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];

    // Crear encabezado
    const thead = document.createElement("thead");
    const header = document.createElement("tr");
    header.innerHTML = `
                <th class="border p-2 bg-yellow-800 rounded-tl-lg columna-fija">Especialista</th>
                <th class="border p-2 bg-yellow-800 rounded-tr-lg columna-fija-area">Área</th>
                ${bloquesHorarios.map((bloque, index) => `
                    <th class="border p-1 bg-yellow-800 text-xs ${index === bloqueActualIndex ? 'columna-hora-actual' : ''}">
                        ${bloque.nombre}<br>${bloque.inicio}-${bloque.fin}
                    </th>
                `).join('')}
            `;
    thead.appendChild(header);
    tabla.appendChild(thead);

    // Crear cuerpo de la tabla
    const tbody = document.createElement("tbody");

    trabajadores.forEach(trabajador => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
                    <td class="columna-fija" title="${trabajador.nombre}">${trabajador.nombre}</td>
                    <td class="columna-fija-area">${trabajador.area}</td>
                `;

        bloquesHorarios.forEach((bloque, index) => {
            const actividades = buscarActividades(trabajador.nombre, hoyStr, index);
            let contenido = "—";
            let colorClass = "bg-gray-700";
            let esBloqueActual = index === bloqueActualIndex;

            if (actividades.length > 0) {
                // Ordenar actividades por hora de inicio
                actividades.sort((a, b) => {
                    const horaA = new Date(`${a.fecha_inicio}T${a.hora_inicio}`);
                    const horaB = new Date(`${b.fecha_inicio}T${b.hora_inicio}`);
                    return horaA - horaB;
                });

                const actividadPrincipal = actividades[0];
                let estado = actividadPrincipal.estado;

                // Verificar si es el bloque actual y la actividad está en curso
                const inicio = new Date(`${actividadPrincipal.fecha_inicio}T${actividadPrincipal.hora_inicio}`);
                const fin = new Date(`${actividadPrincipal.fecha_fin}T${actividadPrincipal.hora_fin}`);

                if (hoy >= inicio && hoy < fin) {
                    esBloqueActual = true;
                    if (estado === 'POR TRABAJAR') {
                        estado = 'TRABAJANDO';
                    }
                }

                colorClass = ESTADOS[estado].color;

                // Contenido principal (con texto "Turno iniciado" más grande)
                contenido = `
                            <div class="text-xs font-bold truncate-text">${actividadPrincipal.actividad}</div>
                            ${actividadPrincipal.cliente ? `<div class="text-[10px] italic truncate-text">${actividadPrincipal.cliente}</div>` : ''}
                            <div class="text-hora truncate-text">${formatoHora(actividadPrincipal.hora_inicio)} - ${formatoHora(actividadPrincipal.hora_fin)}</div>
                            ${actividadPrincipal.fecha_inicio !== actividadPrincipal.fecha_fin ?
                        `<div class="text-xs font-semibold text-yellow-400">(Turno iniciado el ${formatoFechaCompleta(actividadPrincipal.fecha_inicio)})</div>` : ''}
                            <div class="etiqueta-estado ${ESTADOS[estado].color}">${ESTADOS[estado].texto}</div>
                        `;

                // Mostrar actividades adicionales si hay más de 1
                if (actividades.length > 1) {
                    contenido += `<div class="text-[10px] mt-1 text-center cursor-pointer underline truncate-text" 
                                onclick="mostrarActividadesSuperpuestas('${trabajador.nombre}', '${hoyStr}', ${index})">
                                +${actividades.length - 1} más
                            </div>`;
                } else {
                    // Mostrar botones solo si hay una actividad
                    contenido += `
                            <div class="flex justify-center mt-1 space-x-1">
                                <button onclick="event.stopPropagation(); editarHorario('${actividadPrincipal.id}')" class="btn-editar">Editar</button>
                                <button onclick="event.stopPropagation(); confirmarEliminar('${actividadPrincipal.id}')" class="btn-eliminar">Eliminar</button>
                            </div>`;
                }
            }

            fila.innerHTML += `
                        <td class="border p-1 text-center ${colorClass} 
                            ${esBloqueActual ? 'bloque-actual' : ''} 
                            celda-horario text-white">
                            ${contenido}
                        </td>
                    `;
        });

        tbody.appendChild(fila);
    });

    tabla.appendChild(tbody);
}

// Función para formatear solo hora
function formatoHora(horaStr) {
    return horaStr;
}

// Función para formatear fecha completa (DD-MM-YYYY)
function formatoFechaCompleta(fechaStr) {
    const [año, mes, dia] = fechaStr.split('-');
    return `${dia}-${mes}-${año}`;
}

// Función para formatear fecha corta (DD-MM)
function formatoFechaCorta(fechaStr) {
    const [año, mes, dia] = fechaStr.split('-');
    return `${dia}-${mes}`;
}

// Función para formatear fecha textual
function formatoFechaTextual(fechaStr) {
    const fecha = new Date(fechaStr);
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    return fecha.toLocaleDateString("es-CL", opciones);
}

// Función para formatear fecha para el modal de actividades superpuestas
function formatoFechaModal(fechaInicioStr, fechaFinStr, horaInicio, horaFin) {
    const fechaInicio = new Date(`${fechaInicioStr}T${horaInicio}`);
    const fechaFin = new Date(`${fechaFinStr}T${horaFin}`);

    // Si es el mismo día
    if (fechaInicio.toDateString() === fechaFin.toDateString()) {
        return `${formatoFechaCorta(fechaInicioStr)} ${horaInicio} - ${horaFin}`;
    }

    // Si son días diferentes (turno nocturno)
    return `${formatoFechaCorta(fechaInicioStr)} ${horaInicio} - ${formatoFechaCorta(fechaFinStr)} ${horaFin}`;
}

// Función para calcular el número de semana
function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Función para generar la tabla de horarios semanal (mejorada para mostrar actividades superpuestas)
function generarTablaSemanal() {
    const tabla = document.getElementById("tabla-semanal");
    if (!tabla) return;

    tabla.innerHTML = "";

    // Obtener el lunes de la semana actual
    const lunes = new Date(fechaSeleccionada);
    lunes.setDate(fechaSeleccionada.getDate() - (fechaSeleccionada.getDay() === 0 ? 6 : fechaSeleccionada.getDay() - 1));

    // Obtener el domingo de la semana actual
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);

    // Calcular número de semana
    const numeroSemana = getWeekNumber(lunes);

    // Formatear fechas en español
    const opcionesFecha = { day: 'numeric', month: 'long', year: 'numeric' };
    const fechaInicioStr = lunes.toLocaleDateString("es-CL", opcionesFecha);
    const fechaFinStr = domingo.toLocaleDateString("es-CL", opcionesFecha);

    // Actualizar el título de la semana
    document.getElementById("fecha-mostrada").textContent =
        `Semana ${numeroSemana} | ${fechaInicioStr} al ${fechaFinStr}`;

    // Crear encabezado con los días de la semana (Lunes a Domingo)
    const thead = document.createElement("thead");
    const header = document.createElement("tr");
    header.innerHTML = `
                <th class="border p-2 bg-yellow-800 rounded-tl-lg columna-fija">Especialista</th>
                <th class="border p-2 bg-yellow-800 rounded-tr-lg columna-fija-area">Área</th>
            `;

    // Generar encabezados para cada día de la semana
    const diasSemana = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
        const dia = new Date(lunes);
        dia.setDate(lunes.getDate() + i);
        diasSemana.push(dia);

        const esHoy = dia.toDateString() === hoy.toDateString();
        const diaStr = dia.toLocaleDateString("es-CL", { weekday: 'short', day: 'numeric' });

        header.innerHTML += `
                    <th class="border p-1 bg-yellow-800 text-xs ${esHoy ? 'columna-dia-actual' : ''}">
                        ${diaStr}
                    </th>
                `;
    }

    thead.appendChild(header);
    tabla.appendChild(thead);

    // Crear cuerpo de la tabla
    const tbody = document.createElement("tbody");

    trabajadores.forEach(trabajador => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
                    <td class="columna-fija" title="${trabajador.nombre}">${trabajador.nombre}</td>
                    <td class="columna-fija-area">${trabajador.area}</td>
                `;

        // Para cada día de la semana (Lunes a Domingo)
        diasSemana.forEach(dia => {
            const diaStr = dia.toISOString().split('T')[0];
            const actividadesDia = [];

            // Buscar actividades para este día
            if (horarios[trabajador.nombre]) {
                for (const id in horarios[trabajador.nombre]) {
                    const actividad = horarios[trabajador.nombre][id];
                    const inicio = new Date(`${actividad.fecha_inicio}T${actividad.hora_inicio}`);
                    const fin = new Date(`${actividad.fecha_fin}T${actividad.hora_fin}`);

                    // Verificar si la actividad ocurre en este día específico
                    const actividadEnEsteDia = (
                        (inicio <= dia && fin >= dia) ||
                        (inicio.toDateString() === dia.toDateString()) ||
                        (fin.toDateString() === dia.toDateString())
                    );

                    if (actividadEnEsteDia) {
                        actividadesDia.push(actividad);
                    }
                }
            }

            let contenido = "";
            let colorClass = "bg-gray-700";
            let esHoy = dia.toDateString() === hoy.toDateString();

            if (actividadesDia.length > 0) {
                // Ordenar actividades por hora de inicio
                actividadesDia.sort((a, b) => {
                    const horaA = new Date(`${a.fecha_inicio}T${a.hora_inicio}`);
                    const horaB = new Date(`${b.fecha_inicio}T${b.hora_inicio}`);
                    return horaA - horaB;
                });

                // Mostrar todas las actividades para este día
                contenido = actividadesDia.map(actividad => {
                    let estado = actividad.estado;

                    // Verificar si es el día actual y la actividad está en curso
                    if (esHoy) {
                        const ahora = new Date();
                        const inicio = new Date(`${actividad.fecha_inicio}T${actividad.hora_inicio}`);
                        const fin = new Date(`${actividad.fecha_fin}T${actividad.hora_fin}`);

                        if (ahora >= inicio && ahora < fin) {
                            esHoy = true;
                            if (estado === 'POR TRABAJAR') {
                                estado = 'TRABAJANDO';
                            }
                        }
                    }

                    colorClass = ESTADOS[estado].color;

                    return `
                                <div class="actividad-multiple ${ESTADOS[estado].color}">
                                    <div class="text-xs font-bold truncate-text">${actividad.actividad}</div>
                                    ${actividad.cliente ? `<div class="text-[10px] italic truncate-text">${actividad.cliente}</div>` : ''}
                                    <div class="text-hora truncate-text">${formatoHora(actividad.hora_inicio)} - ${formatoHora(actividad.hora_fin)}</div>
                                    ${actividad.fecha_inicio !== actividad.fecha_fin ?
                            `<div class="text-xs font-semibold text-yellow-400">(Turno iniciado el ${formatoFechaCompleta(actividad.fecha_inicio)})</div>` : ''}
                                    <div class="etiqueta-estado ${ESTADOS[estado].color}">${ESTADOS[estado].texto}</div>
                                    <div class="flex justify-center mt-1 space-x-1">
                                        <button onclick="event.stopPropagation(); editarHorario('${actividad.id}')" class="btn-editar">Editar</button>
                                        <button onclick="event.stopPropagation(); confirmarEliminar('${actividad.id}')" class="btn-eliminar">Eliminar</button>
                                    </div>
                                </div>
                            `;
                }).join('');
            } else {
                contenido = "—";
            }

            fila.innerHTML += `
                        <td class="border p-1 text-center ${actividadesDia.length > 0 ? ESTADOS[actividadesDia[0].estado].color : colorClass} 
                            ${esHoy ? 'bloque-actual' : ''} 
                            celda-horario text-white">
                            ${contenido}
                        </td>
                    `;
        });

        tbody.appendChild(fila);
    });

    tabla.appendChild(tbody);
}

// Resto del código permanece igual...

// Inicialización al cargar la página
window.onload = function () {
    // Llenar select de trabajadores
    const selectTrabajador = document.getElementById("select-trabajador");
    trabajadores.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.nombre;
        opt.textContent = `${t.nombre} (${t.area})`;
        selectTrabajador.appendChild(opt);
    });

    // Llenar select de actividades
    const selectActividad = document.getElementById("select-actividad");
    const actividades = [
        { nombre: "OFICINA", requiere_cliente: false },
        { nombre: "PROYECTO", requiere_cliente: true },
        { nombre: "TURNO SOC", requiere_cliente: false },
        { nombre: "SERVICIO EN TERRENO", requiere_cliente: true },
        { nombre: "VISITA A TERRENO", requiere_cliente: true },
        { nombre: "EN CAPACITACION", requiere_cliente: false },
        { nombre: "LIBRE", requiere_cliente: false },
        { nombre: "LICENCIA MEDICA", requiere_cliente: false },
        { nombre: "SOPORTE REMOTO", requiere_cliente: false },
        { nombre: "VACACIONES", requiere_cliente: false },
        { nombre: "REUNION", requiere_cliente: true }
    ];

    actividades.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.nombre;
        opt.textContent = a.nombre;
        opt.dataset.requiereCliente = a.requiere_cliente;
        selectActividad.appendChild(opt);
    });

    // Configurar evento change para actividades
    selectActividad.addEventListener("change", function (e) {
        const actividad = e.target.value;
        const selectEstado = document.getElementById("select-estado");

        if (actividad === "LICENCIA MEDICA") {
            selectEstado.value = "LICENCIA";
            selectEstado.disabled = true;
        } else if (actividad === "VACACIONES") {
            selectEstado.value = "LIBRE";
            selectEstado.disabled = true;
        } else {
            selectEstado.disabled = false;
        }

        const requiere = ['PROYECTO', 'SERVICIO EN TERRENO', 'VISITA A TERRENO', 'REUNION'].includes(actividad);
        document.getElementById("cliente-container").classList.toggle("hidden", !requiere);

        // Para el modal rápido
        document.getElementById("rapida-cliente-container").classList.toggle("hidden", !requiere);
    });

    // Configurar evento change para el select de cliente
    document.getElementById("select-cliente").addEventListener("change", function (e) {
        const cliente = e.target.value;
        document.getElementById("otro-cliente-container").classList.toggle("hidden", cliente !== "OTRO CLIENTE");
    });

    // Configurar navegación por semanas
    fechaSeleccionada = new Date();

    // Determinar bloque actual
    const ahora = new Date();
    const horaActual = ahora.getHours() + ":" + (ahora.getMinutes() < 10 ? "0" : "") + ahora.getMinutes();
    bloquesHorarios.forEach((bloque, index) => {
        if (horaActual >= bloque.inicio && horaActual < bloque.fin) {
            bloqueActualIndex = index;
        }
    });

    // Generar vistas iniciales
    generarTablaHoy();
    generarTablaSemanal();

    // Actualizar reloj
    actualizarReloj();
    setInterval(actualizarReloj, 1000);

    // Configurar intervalo para actualizar estados cada minuto
    setInterval(() => {
        if (actualizarEstadosHorarios()) {
            actualizarVistas();
        }
    }, 60000);

    // Cargar datos de ejemplo si no hay datos guardados
    if (Object.keys(horarios).length === 0) {
        // Datos de ejemplo
        const hoy = new Date();
        const manana = new Date();
        manana.setDate(hoy.getDate() + 1);

        const hoyStr = hoy.toISOString().split('T')[0];
        const mananaStr = manana.toISOString().split('T')[0];

        horarios = {
            "Franklin Mendoza": {
                "1": {
                    id: "1",
                    trabajador: "Franklin Mendoza",
                    actividad: "TURNO SOC",
                    cliente: null,
                    fecha_inicio: hoyStr,
                    hora_inicio: "21:00",
                    fecha_fin: mananaStr,
                    hora_fin: "06:00",
                    estado: "POR TRABAJAR"
                },
                "4": {
                    id: "4",
                    trabajador: "Franklin Mendoza",
                    actividad: "REUNION",
                    cliente: "CODELPA",
                    fecha_inicio: hoyStr,
                    hora_inicio: "10:00",
                    fecha_fin: hoyStr,
                    hora_fin: "16:00",
                    estado: "PENDIENTE"
                }
            },
            "Johandry Bellorin": {
                "2": {
                    id: "2",
                    trabajador: "Johandry Bellorin",
                    actividad: "PROYECTO",
                    cliente: "CODELPA",
                    fecha_inicio: hoyStr,
                    hora_inicio: "08:00",
                    fecha_fin: hoyStr,
                    hora_fin: "17:00",
                    estado: "POR TRABAJAR"
                }
            },
            "Gabriel Fuentes": {
                "3": {
                    id: "3",
                    trabajador: "Gabriel Fuentes",
                    actividad: "SERVICIO EN TERRENO",
                    cliente: "HVT",
                    fecha_inicio: "2025-07-10",
                    hora_inicio: "08:00",
                    fecha_fin: "2025-07-11",
                    hora_fin: "17:00",
                    estado: "POR TRABAJAR"
                },
                "5": {
                    id: "5",
                    trabajador: "Gabriel Fuentes",
                    actividad: "REUNION",
                    cliente: "IT-EXPERIENCE",
                    fecha_inicio: "2025-07-10",
                    hora_inicio: "10:00",
                    fecha_fin: "2025-07-10",
                    hora_fin: "12:00",
                    estado: "PENDIENTE"
                }
            }
        };

        guardarHorariosEnStorage();
        generarTablaHoy();
        generarTablaSemanal();
    }
};
