# Instrucciones para la IP Local (`config.js`)

⚠️ **IMPORTANTE:** Para que la aplicación funcione en tu computadora y dispositivos locales, debes crear un archivo llamado `config.js` en esta misma carpeta (`src/`).

### Pasos a seguir:

1. Crea un nuevo archivo en esta carpeta (`src/`) y nómbralo `config.js`.
2. Ejecuta `ipconfig` en tu terminal para obtener tu Dirección IPv4 (ej. `192.168.100.19`).
3. Copia el siguiente código y pégalo dentro de tu nuevo `config.js`, reemplazando la IP por la tuya:

```javascript
export const API_URL = 'http://192.168.100.19:8080/api/v1'; // Reemplaza esta IP con tu propia IP local

export default {
    API_URL,
};
```

*Nota: El archivo `config.js` está ignorado en Git (.gitignore) a propósito para evitar sobreescribir las IPs de otros desarrolladores del equipo. Este archivo README es solo una guía para que cualquier miembro nuevo sepa cómo configurarlo.*
