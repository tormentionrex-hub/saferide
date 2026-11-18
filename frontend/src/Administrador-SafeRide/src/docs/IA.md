NO TOQUES EL BACKEND O EL FRONT END, Solo dime que ocupas 

IA 

Crea una página profesional en React exactamente inspirada en un dashboard moderno de administración de conductores para una aplicación de transporte tipo Uber.

REQUISITOS IMPORTANTES:

- Usa React funcional con hooks.
- Usa arquitectura limpia y profesional.
- Todo el CSS debe estar separado en otro archivo.
- No usar Tailwind.
- Usar react-icons.
- El diseño debe verse moderno, enterprise y muy parecido a un dashboard real SaaS.
- Responsive para desktop, tablet y mobile.
- Comenta el código como un programador senior.
- Usa buenas prácticas reales de desarrollo frontend.
- Preparar toda la estructura para conectar backend en el futuro.
- NO usar datos quemados.
- Crear estados vacíos listos para consumir APIs.
- Preparar funciones async para services.
- La página debe quedar lista para usar Axios o Fetch.
- Usar componentes reutilizables si es necesario.
- Mantener clean code y separación de responsabilidades.

LA PÁGINA DEBE TENER:

1. Sidebar oscuro lateral izquierdo
- Logo RideAdmin
- Menú navegación
- Item activo resaltado
- Perfil admin abajo

2. Topbar superior
- Search input
- Notifications icon
- Settings icon
- Admin avatar

3. Header principal
- Título “Conductores”
- Descripción
- Botón azul “Registrar Conductor”

4. Cards de estadísticas
- Total Drivers
- Active Now
- Avg Rating
- On Trip

5. Grid de conductores
Cada card debe incluir:
- Avatar
- Nombre
- Rating
- Status badge
- Vehículo
- Placa
- Información dinámica
- Botones

6. Empty state
Si no hay conductores:
- Mostrar mensaje profesional
- Diseño moderno

7. Add Driver Card
- Card con borde dashed
- Icono centrado
- Texto “Add New Driver”

REQUISITOS TÉCNICOS:

- Crear:
  - DriversPage.jsx
  - DriversPage.css

- Usar:
  useState
  useEffect

- Preparar estructura para:
  driverService.getAllDrivers()

Ejemplo:

const [drivers, setDrivers] = useState([]);

useEffect(() => {
  loadDrivers();
}, []);

const loadDrivers = async () => {
  try {
    // backend future
  } catch (error) {
    console.error(error);
  }
};

IMPORTANTE:
Quiero código profesional real, no básico.
Debe parecer desarrollado por un senior frontend engineer.