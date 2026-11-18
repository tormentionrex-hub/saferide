# Guía Técnica: Transformación de SafeRide a una Intranet 100% Privada

Esta guía detalla los pasos, configuraciones y mejores prácticas para desplegar e integrar los proyectos **Admin_Saferide**, **saferide-frontend** y **saferide-backend** como una **Intranet Corporativa Privada**, restringiendo todo acceso desde el internet público y permitiendo su uso exclusivamente dentro de una red local (LAN) o mediante una Red Privada Virtual (VPN).

---

## 📌 Arquitectura General de una Intranet

En un entorno público, cualquier persona con la URL puede intentar acceder a los frontends o atacar el backend. En un entorno de **Intranet**, el tráfico se encapsula en una red cerrada:

```mermaid
graph TD
    subgraph Internet Público (Bloqueado)
        UserPublic[Usuario Externo] -->|Intento de Conexión| FW[Firewall Corporativo]
        FW -->|DENEGAR ACCESO| Drop[Tráfico Descartado]
    end

    subgraph Red Local Privada (LAN / VPN)
        UserLocal[Dispositivo Autorizado] -->|Accede mediante IP Local / DNS Interno| Nginx[Servidor Web Nginx Interno]
        UserVPN[Usuario Remoto con VPN] -->|Túnel Seguro WireGuard/OpenVPN| Nginx
        
        Nginx -->|Sirve Frontend Admin| Admin[Admin_Saferide]
        Nginx -->|Sirve Frontend Cliente| Client[saferide-frontend]
        Nginx -->|Proxy a API| BE[saferide-backend:5000]
    end
```

---

## 1. Configuración del Servidor y Red Local (LAN)

Para que el sistema funcione de forma privada, primero debes hospedar el backend y los frontends en un servidor físico o máquina virtual dedicada que se encuentre dentro de tu red local.

### A. Asignación de IP Estática en el Servidor
La máquina donde correrá el backend debe tener una dirección IP privada fija en el router local.
* **Ejemplo de IP privada:** `192.168.1.100` o `10.0.0.100`.
* Configura esto en los ajustes de red del sistema operativo del servidor o mediante **DHCP Reservation** en tu router.

### B. Configuración de DNS Local (Opcional pero Recomendado)
En lugar de entrar usando IPs como `http://192.168.1.100:5173`, puedes configurar un servidor DNS interno (como Pi-hole o el propio Active Directory de la empresa) para mapear nombres bonitos:
* `http://saferide.admin` ➡️ `192.168.1.100`
* `http://saferide.app` ➡️ `192.168.1.100`

Si no tienes un servidor DNS, puedes editar temporalmente el archivo `hosts` en cada computadora cliente que necesite acceso:
* **En macOS/Linux:** `/etc/hosts`
* **En Windows:** `C:\Windows\System32\drivers\etc\hosts`
* **Línea a añadir:**
  ```text
  192.168.1.100   saferide.admin
  192.168.1.100   saferide.api
  ```

---

## 2. Ajustes en el Backend (`saferide-backend`)

El backend debe aceptar peticiones de los frontends dentro de la red local, pero rechazar de plano cualquier entrada externa.

### A. Configurar el Binding de Host
Por defecto, al iniciar el servidor local con Express se suele usar `localhost` o `127.0.0.1`. Para permitir que responda a otras computadoras de la red local, el Host debe ser `0.0.0.0` (escucha en todas las interfaces de red local).
En tu archivo de configuración del backend (ej. `server.js` o `app.js`):
```javascript
const PORT = process.env.PORT || 5000;
// Escuchar en 0.0.0.0 para estar disponible en la LAN
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de la Intranet corriendo en la IP local por el puerto ${PORT}`);
});
```

### B. Configurar el CORS Restringido a la LAN
No uses `cors(*)` ya que abriría tu API. Restringe las políticas CORS específicamente a las IPs privadas de tu intranet o a tu DNS local:
```javascript
const cors = require('cors');

const whitelist = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://192.168.1.100:5173', // IP del Admin en la LAN
  'http://192.168.1.100:3000', // IP del Frontend Cliente en la LAN
  'http://saferide.admin',
  'http://saferide.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Acceso no permitido por políticas de la Intranet'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
```

---

## 3. Ajustes en los Frontends (`Admin_Saferide` & `saferide-frontend`)

### A. Configuración de Variables de Entorno (`.env`)
Debes cambiar las variables de entorno de los frontends para que apunten a la IP privada estática del servidor del backend en lugar de `localhost`.

En **`Admin_Saferide/.env`**:
```env
# En lugar de localhost, usa la IP fija del servidor en la LAN
VITE_API_URL=http://192.168.1.100:5000/api
```

En **`saferide-frontend/.env`**:
```env
VITE_API_URL=http://192.168.1.100:5000/api
```

### B. Exponer el Frontend en la Red Local para Pruebas
Durante el desarrollo, para ver el frontend desde otra computadora conectada al mismo Wi-Fi/Red, debes iniciar Vite con el flag `--host`:
Modifica tu archivo `package.json` en los frontends:
```json
"scripts": {
  "dev": "vite --host 0.0.0.0",
  "build": "vite build",
  "preview": "vite preview --host 0.0.0.0"
}
```
Al ejecutar `npm run dev`, Vite te dará la URL de red local (ej. `http://192.168.1.100:5173`) para que entres desde cualquier celular o PC conectada al mismo router.

---

## 4. Despliegue de Producción Privado con Nginx (Servidor Web)

Para producción en una intranet, **no** debes usar `npm run dev`. Lo ideal es compilar el frontend (`npm run build`) y servir los archivos estáticos usando **Nginx**, configurándolo para que actúe también como un proxy seguro hacia el backend.

### Ejemplo de Configuración de Nginx Interno (`/etc/nginx/sites-available/saferide`)
```nginx
server {
    listen 80;
    server_name 192.168.1.100 saferide.admin;

    # Permitir únicamente accesos de subredes privadas locales (IP Whitelisting)
    allow 192.168.1.0/24;  # Rango de tu red local
    allow 10.0.0.0/8;      # Rango alternativo o VPN
    allow 127.0.0.1;       # El mismo servidor
    deny all;              # Bloquear cualquier otra IP (Internet Externo)

    # FRONTEND ADMIN
    location / {
        root /var/www/saferide-admin/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # PROXY HACIA EL BACKEND Express
    location /api/ {
        proxy_pass http://127.0.0.1:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Capas de Seguridad Críticas para Intranets

### A. SSL Local (HTTPS Privado)
Aunque sea una intranet, las contraseñas e información viajan expuestas si usas `http`. Es fundamental habilitar `https`:
* Usa herramientas como [mkcert](https://github.com/FiloSottile/mkcert) para generar certificados SSL locales válidos y de confianza para tus navegadores internos.
* O monta tu propia **Entidad Certificadora (CA) Interna** en la infraestructura de la empresa.

### B. Implementación de una VPN (Acceso Remoto Seguro)
Si directivos o conductores necesitan acceder al sistema desde fuera de las instalaciones físicas (ej. desde sus hogares o la calle):
1. **El Servidor se mantiene cerrado al público** sin abrir puertos en el módem/router.
2. Se instala un servidor de VPN en la red local (como **WireGuard** o **Tailscale**).
3. Los usuarios autorizados instalan el cliente VPN en sus computadoras o celulares.
4. Al encender la VPN, sus dispositivos entran de forma segura al canal privado y pueden abrir la URL `http://saferide.admin` como si estuvieran físicamente en la oficina.

### C. Cortafuegos (Firewall)
Habilita el Firewall de tu servidor para bloquear cualquier conexión que no venga de la interfaz local o la subred de la oficina:
```bash
# Ejemplo usando UFW en Linux
sudo ufw default deny incoming
sudo ufw default allow outgoing
# Permitir puertos de Nginx solo para la red interna
sudo ufw allow from 192.168.1.0/24 to any port 80
sudo ufw allow from 192.168.1.0/24 to any port 443
sudo ufw enable
```

---

## 📝 Resumen del Plan de Trabajo (No intrusivo)

| Fase | Tarea Principal | Estado |
| :--- | :--- | :--- |
| **Fase 1: Red** | Asignar IP estática al servidor local (ej: `192.168.1.100`). | 💡 Planificado |
| **Fase 2: Backend** | Cambiar `app.listen` para usar `0.0.0.0` y agregar IPs locales a la lista de origen CORS. | 💡 Planificado |
| **Fase 3: Frontend** | Actualizar `.env` apuntando a la IP estática y agregar `--host` al script de desarrollo. | 💡 Planificado |
| **Fase 4: Despliegue** | Compilar (`npm run build`) y configurar Nginx con restricciones de subred `allow/deny`. | 💡 Planificado |
| **Fase 5: Seguridad** | Configurar túnel VPN (Tailscale/WireGuard) para acceso remoto cifrado y seguro. | 💡 Planificado |
