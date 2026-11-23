export const CAR_DATA = {
  Acura: ['MDX', 'RDX', 'TLX', 'TSX', 'Integra'],
  Audi: ['A3', 'A4', 'Q3', 'Q5', 'Q7'],
  BMW: ['Serie 1', 'Serie 3', 'Serie 5', 'X1', 'X3', 'X5'],
  BYD: ['S1 Pro', 'Yuan Plus', 'Tang', 'Song Plus', 'F3', 'Dolphin'],
  Chery: ['Tiggo 2 Pro', 'Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'QQ'],
  Chevrolet: ['Colorado', 'Tracker', 'Spark', 'Aveo', 'Captiva', 'Groove'],
  Citroen: ['C3', 'C4 Cactus', 'C5 Aircross', 'Berlingo', 'Jumpy'],
  Daihatsu: ['Terios', 'Bego', 'Sirion', 'Delta', 'Gran Max'],
  Dodge: ['RAM 1500', 'RAM 2500', 'Journey', 'Durango', 'Dakota'],
  Fiat: ['Strada', 'Fiorino', 'Pulse', 'Uno', '500', 'Fastback'],
  Ford: ['Ranger', 'Everest', 'Explorer', 'EcoSport', 'F-150', 'Focus'],
  Geely: ['Coolray', 'Azkarra', 'Okavango', 'GX3 Pro', 'Geometry C'],
  GMC: ['Sierra', 'Acadia', 'Terrain', 'Yukon', 'Canyon'],
  GreatWall: ['Wingle 5', 'Wingle 7', 'Poer', 'Haval M4', 'Voleex'],
  Haval: ['H6', 'Jolion', 'H2', 'H9', 'M4'],
  Honda: ['CR-V', 'Civic', 'HR-V', 'Accord', 'Fit', 'Pilot'],
  Hyundai: ['Tucson', 'Accent Blue', 'Elantra', 'Creta', 'Grand i10', 'Santa Fe', 'Kona'],
  Isuzu: ['D-Max', 'MU-X', 'NLR', 'NPR', 'FTR'],
  JAC: ['T8', 'JS2', 'JS4', 'S2', 'Sunray', 'E10X'],
  Jeep: ['Grand Cherokee', 'Wrangler', 'Compass', 'Renegade', 'Cherokee'],
  Jetour: ['Dashing', 'X70 Plus', 'X70', 'X90 Plus'],
  Kia: ['Sportage', 'Picanto', 'Rio', 'Seltos', 'Sorento', 'Cerato', 'Soluto'],
  LandRover: ['Defender', 'Discovery', 'Range Rover Evoque', 'Range Rover Sport'],
  Lexus: ['RX', 'NX', 'UX', 'GX', 'IS'],
  Mazda: ['CX-5', 'Mazda 3', 'CX-3', 'CX-30', 'BT-50', 'CX-9'],
  MercedesBenz: ['GLC', 'GLE', 'Clase C', 'Clase A', 'Clase E', 'Vito'],
  MG: ['ZS', 'HS', 'MG3', 'MG5', 'Marvel R', 'MG4'],
  Mitsubishi: ['Montero Sport', 'L200', 'Outlander', 'ASX', 'Eclipse Cross', 'Montero'],
  Nissan: ['Frontier', 'Sentra', 'Qashqai', 'Kicks', 'Versa', 'X-Trail', 'March'],
  Peugeot: ['2008', '3008', '5008', '208', 'Partner', 'Landtrek'],
  Renault: ['Kwid', 'Duster', 'Oroch', 'Stepway', 'Koleos', 'Logan'],
  Subaru: ['XV', 'Forester', 'Outback', 'Impreza', 'Crosstrek'],
  Suzuki: ['Vitara', 'Swift', 'Jimny', 'S-Presso', 'Ertiga', 'Dzire', 'Baleno'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X'],
  Toyota: ['Hilux', 'Corolla', 'Yaris', 'RAV4', 'Prado', 'Fortuner', 'Rush', 'Agya'],
  Volkswagen: ['Amarok', 'Tiguan', 'Jetta', 'T-Cross', 'Gol', 'Taos', 'Nivus'],
  Volvo: ['XC40', 'XC60', 'XC90', 'S60', 'V40', 'C40'],
};

export const BRANDS = Object.keys(CAR_DATA);
export const COLORS = ['Blanco', 'Negro', 'Gris', 'Plateado', 'Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranja', 'Café', 'Beige', 'Vinilado'];
export const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));

export const COMPANIES = [
  'Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian', '3M',
  'DHL', 'Bill Gosling Outsourcing (BGO)', 'WeWork Costa Rica',
  'Concentrix', 'Nestlé Costa Rica'
];

export const SCHEDULES = [
  '08:00 - 17:00', '07:00 - 16:00', '06:00 - 15:00',
  '22:00 - 06:00 (Nocturno)', 'Rotativo', 'Fines de semana'
];
