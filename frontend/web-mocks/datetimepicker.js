// Reemplazo web de @react-native-community/datetimepicker.
// El paquete no tiene implementación para web (no muestra nada), así que en el
// navegador no se podía elegir fecha ni hora: el registro de vehículo, publicar
// viaje y los filtros por fecha quedaban bloqueados. Metro lo sustituye por
// este archivo solo cuando platform === 'web' (ver metro.config.js).
//
// Se comporta como el diálogo de Android: se abre al montarse y llama a
// onChange({ type: 'set' }, fecha) al aceptar, u onChange({ type: 'dismissed' })
// al cancelar. Usa los <input type="date|time"> nativos del navegador.
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

export default function DateTimePicker({ value, mode = 'date', minimumDate, maximumDate, onChange }) {
  const base = isValidDate(value) ? value : new Date();
  const isTime = mode === 'time';
  const [text, setText] = useState(isTime ? toTimeStr(base) : toDateStr(base));
  const [error, setError] = useState('');

  const close = (event, date) => { if (onChange) onChange(event, date); };

  const accept = () => {
    const result = new Date(base.getTime());
    if (isTime) {
      const m = /^(\d{2}):(\d{2})$/.exec(text);
      if (!m) { setError('Hora inválida'); return; }
      result.setHours(Number(m[1]), Number(m[2]), 0, 0);
    } else {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      if (!m) { setError('Fecha inválida'); return; }
      result.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const day = toDateStr(result);
      if (isValidDate(minimumDate) && day < toDateStr(minimumDate)) { setError('La fecha es anterior a la permitida'); return; }
      if (isValidDate(maximumDate) && day > toDateStr(maximumDate)) { setError('La fecha es posterior a la permitida'); return; }
    }
    close({ type: 'set', nativeEvent: { timestamp: result.getTime() } }, result);
  };

  const inputProps = {
    type: isTime ? 'time' : 'date',
    value: text,
    autoFocus: true,
    'aria-label': isTime ? 'Hora' : 'Fecha',
    onChange: (e) => { setText(e.target.value); setError(''); },
    style: { fontSize: 18, padding: 10, borderRadius: 10, border: '1px solid #c7cdf5', width: '100%', boxSizing: 'border-box' },
  };
  if (!isTime && isValidDate(minimumDate)) inputProps.min = toDateStr(minimumDate);
  if (!isTime && isValidDate(maximumDate)) inputProps.max = toDateStr(maximumDate);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close({ type: 'dismissed' })}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{isTime ? 'Selecciona la hora' : 'Selecciona la fecha'}</Text>
          {React.createElement('input', inputProps)}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <TouchableOpacity onPress={() => close({ type: 'dismissed' })} style={styles.btn}>
              <Text style={styles.cancel}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={accept} style={[styles.btn, styles.primary]}>
              <Text style={styles.ok}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 14 },
  title: { fontSize: 16, fontWeight: '600', color: '#1f2340' },
  error: { color: '#d93025', fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  primary: { backgroundColor: '#4b68ff' },
  cancel: { color: '#4b68ff', fontWeight: '600' },
  ok: { color: '#fff', fontWeight: '600' },
});
