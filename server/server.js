require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

// 1. Configuración básica (ORDEN CRÍTICO)
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 2. Configuración de sesión reforzada
app.use(session({
    name: 'horarios.session',
    secret: process.env.SESSION_SECRET || 'clave-segura-'+Math.random().toString(36).substring(2),
    resave: true,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// 3. Usuario de prueba
const users = [
    { username: 'admin', password: 'admin123', role: 'admin' }
];

// 4. Redirección infalible al login
app.get('/', (req, res) => {
    if (!req.session.user) {
        // Método 100% efectivo para forzar redirección
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <script>
                    // 1. Limpieza total de caché
                    localStorage.clear();
                    sessionStorage.clear();
                    
                    // 2. Forzar recarga sin caché
                    fetch('/login.html', {cache: "no-store"})
                        .then(() => {
                            // 3. Redirección definitiva
                            window.location.replace('/login.html');
                        })
                        .catch(() => {
                            // 4. Backup por si falla el fetch
                            window.location.href = '/login.html';
                        });
                </script>
                <noscript>
                    <!-- 5. Backup para navegadores sin JS -->
                    <meta http-equiv="refresh" content="0;url=/login.html">
                </noscript>
            </head>
            <body>
                Redireccionando al login...
            </body>
            </html>
        `);
    }
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 5. Ruta de login
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.post('/login', (req, res) => {
    const user = users.find(u => u.username === req.body.username && u.password === req.body.password);
    if (user) {
        req.session.user = user;
        return res.redirect('/');
    }
    res.redirect('/login.html?error=1');
});

// 6. Logout reforzado
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('horarios.session');
        res.send(`
            <script>
                // Limpieza completa antes de redirigir
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login.html';
            </script>
        `);
    });
});

// 7. Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    ====================================
    🚀 Servidor funcionando correctamente
    ====================================
    URL: http://localhost:${PORT}
    
    Credenciales de prueba:
    Usuario: admin
    Contraseña: admin123
    
    Acceso directo al login:
    http://localhost:${PORT}/login.html
    `);
});