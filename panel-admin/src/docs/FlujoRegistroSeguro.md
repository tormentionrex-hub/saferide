14/5/26 
Comprobar que llega el correo con la password "temporal" porque el backend de ahora el codigo lo hace local "simulado" 

Verificar que el sistema realmente envíe el correo con la contraseña/código temporal usando Nodemailer y Gmail, fuera del modo local simulado.

# 🔐 Flujo de Registro y Verificación de Usuarios (SafeRide)

Este documento detalla el proceso técnico y de seguridad que ocurre cuando un administrador registra a un nuevo **Conductor** o **Pasajero** desde el Panel Administrativo.

## 1. Generación de Identidad
Cuando el administrador presiona "Completar Registro", el frontend ejecuta una función interna llamada `generateTempPassword()`.

*   **Lógica**: Crea una cadena aleatoria (ej. `SafeRide@j7k2`).
*   **Seguridad**: Esta contraseña es temporal y solo sirve para la creación inicial del registro en la base de datos MongoDB. El administrador no necesita anotarla ni enviarla manualmente.

## 2. Proceso de Registro (Frontend -> Backend)
El Panel realiza dos peticiones consecutivas al servidor:

1.  **Registro de Cuenta (`POST /auth/register`)**:
    *   Envía los datos personales, el vehículo (si es conductor) y la **Contraseña Temporal**.
    *   El backend encripta la contraseña y guarda al usuario con el estado `isActive: true`.
  
2.  **Disparador de Verificación (`POST /auth/send-verification-code`)**:
    *   El panel solicita al servidor que genere un código de 6 dígitos.
    *   Este código se vincula al correo electrónico del nuevo usuario.

## 3. Sistema de Notificación (Email)
El backend utiliza **Nodemailer** configurado con Gmail para enviar la notificación.

### A. Modo Producción (Correo Real)
Si las variables de entorno `EMAIL_USER` y `EMAIL_PASS` están configuradas, el servidor envía un correo elegante con el código de 6 dígitos al destinatario.

### B. Modo Desarrollo (Bypass de Seguridad)
Para agilizar las pruebas de desarrollo sin depender de la red o de correos reales:
*   **Código Maestro**: El sistema siempre aceptará el código **`000000`** como válido si el entorno es `development` o si el correo contiene la palabra `test`.
*   **Logs**: El código real generado se imprime en la terminal del backend para que el desarrollador pueda verlo sin abrir su bandeja de entrada.

## 4. Activación en la App Móvil (React Native)
Cuando el nuevo usuario (Conductor/Pasajero) intenta entrar a la App por primera vez:

1.  Usa la opción **"¿Olvidaste tu contraseña?"** o el flujo de **"Primer Ingreso"**.
2.  Ingresa su correo electrónico.
3.  Recibe (o usa el maestro) el código de 6 dígitos.
4.  El sistema valida el código y le permite **establecer su propia contraseña definitiva**.
5.  A partir de ese momento, la contraseña temporal generada por el admin deja de existir.

---

## 🛠️ Notas para Soporte Técnico
*   **¿El correo no llega?**: Verifica que el servidor no esté en modo `development` o que las credenciales de Gmail no hayan expirado.
*   **¿El código maestro no sirve?**: Asegúrate de que el correo electrónico del usuario tenga el formato correcto y que la variable `NODE_ENV` sea igual a `development`.

**Fecha de última actualización:** 14 de Mayo, 2026
**Autor:** SafeRide Senior Dev Team
