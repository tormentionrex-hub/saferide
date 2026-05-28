import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../context/DriverThemeContext';
import { getUserReviews } from '../services/safescoreService';

/**
 * ReviewsList — muestra reviews recibidas de un usuario con clasificación IA.
 *
 * ─── JUSTIFICACIÓN DE UBICACIÓN (importante) ──────────────────────────────
 * Este componente se monta SOLO en pantallas donde el usuario está por tomar
 * una decisión que involucra a OTRA PERSONA. La razón es que la reputación
 * tiene impacto máximo cuando se muestra en el "momento de la decisión":
 *
 *   • ListOfRequests (conductor): justo antes de aceptar/rechazar a un pasajero
 *   • RideDetail (pasajero):      justo antes de solicitar unirse al viaje del conductor
 *
 * Cita del producto: "para que los usuarios tomen una decisión consciente
 * de con quien van a viajar, ya sea solicitar unirse o aceptarlo a bordo".
 *
 * En el perfil propio (PasajeroProfileScreen, ProfileConductor) la
 * justificación es diferente: que el usuario vea cómo lo perciben y pueda
 * mejorar (o apelar reseñas que considere injustas, cuando esa feature
 * esté disponible).
 *
 * NO usar en feeds, listados generales, ni "todos los conductores cerca"
 * — ahí no hay decisión inmediata y el ruido visual no aporta.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Props:
 *   userId    (string)   — ID del usuario cuyas reviews vamos a mostrar
 *   isOwn     (boolean)  — si true, el componente asume que vemos NUESTRO perfil.
 *                          Solo afecta a la sección "Decisión del agente" (razón
 *                          interna del LLM, debug). El comentario del reviewer
 *                          siempre se muestra porque es la EVIDENCIA de la
 *                          clasificación — ocultarlo sería redundante.
 *   compact   (boolean)  — modo compacto (sin header de stats, ítems más pequeños)
 *   maxItems  (number)   — máximo de items a mostrar (default 5). Las más
 *                          nuevas primero; las viejas quedan fuera del corte
 *                          y desaparecen automáticamente cuando llegan reseñas
 *                          más recientes.
 *
 * Diseño:
 *   - Header con stats (cuántas Satisfechas / Regulares / Tóxicas / Pendientes)
 *     calculadas sobre TODAS las reviews, no solo las visibles
 *   - Lista vertical de hasta `maxItems` reviews ordenadas por fecha desc
 *   - Cada review muestra: estrellas, badge de clasificación coloreado, fecha,
 *     comentario real entre comillas
 *   - Solo en perfil propio (isOwn): caja gris con la razón del agente IA
 */
const ReviewsList = ({ userId, isOwn = false, compact = false, maxItems = 5 }) => {
  const { theme } = useDriverTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ data: [], stats: null });

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getUserReviews(userId, { limit: maxItems });
      setData(result);
    } catch (err) {
      // Sanitización defensiva — nunca exponemos el objeto error completo
      const msg = err?.response?.data?.message || err?.message || 'No se pudieron cargar las reseñas';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId, maxItems]);

  useEffect(() => { load(); }, [load]);

  // ── Estado de carga ────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.surface }]}>
        <ActivityIndicator size="small" color={theme.accent} />
        <Text style={[styles.muted, { color: theme.textSecondary, marginTop: 8 }]}>
          Cargando reseñas...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.surface }]}>
        <Ionicons name="alert-circle-outline" size={24} color={theme.textSecondary} />
        <Text style={[styles.muted, { color: theme.textSecondary, marginTop: 8 }]}>
          {error}
        </Text>
        <TouchableOpacity onPress={load} style={{ marginTop: 8 }}>
          <Text style={{ color: theme.accent, fontFamily: 'Poppins-SemiBold' }}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const reviews = data.data || [];
  const stats = data.stats;

  // ── Sin reviews ────────────────────────────────────────────────────────
  if (reviews.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.surface }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={28} color={theme.textSecondary} />
        <Text style={[styles.muted, { color: theme.textSecondary, marginTop: 8, textAlign: 'center' }]}>
          {isOwn ? 'Aún no has recibido reseñas.' : 'Este usuario aún no tiene reseñas.'}
        </Text>
      </View>
    );
  }

  // ── Render normal ──────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Header de stats */}
      {!compact && stats && stats.total > 0 && (
        <View style={[styles.statsRow, { borderBottomColor: theme.divider }]}>
          {stats.satisfecho > 0 && (
            <StatChip count={stats.satisfecho} label="Satisfechas" color="#16a34a" />
          )}
          {stats.regular > 0 && (
            <StatChip count={stats.regular} label="Regulares" color="#eab308" />
          )}
          {stats.toxica > 0 && (
            <StatChip count={stats.toxica} label="Tóxicas" color="#dc2626" />
          )}
          {stats.pendiente > 0 && (
            <StatChip count={stats.pendiente} label="Pendientes" color={theme.textSecondary} />
          )}
        </View>
      )}

      {/* Lista de reviews */}
      {reviews.map((r, idx) => (
        <ReviewItem
          key={r._id?.toString() || idx}
          review={r}
          isOwn={isOwn}
          compact={compact}
          theme={theme}
          isLast={idx === reviews.length - 1}
        />
      ))}
    </View>
  );
};

// ── Subcomponente: chip de stats ─────────────────────────────────────────
const StatChip = ({ count, label, color }) => (
  <View style={styles.statChip}>
    <View style={[styles.statDot, { backgroundColor: color }]} />
    <Text style={[styles.statCount, { color }]}>{count}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ── Subcomponente: ítem individual de review ─────────────────────────────
const ReviewItem = ({ review, isOwn, compact, theme, isLast }) => {
  const cat = review.moderation?.category || 'Pendiente';
  const catColor = review.moderation?.color || '#94a3b8';

  // Estrellas visuales según rating
  const stars = [];
  const r = review.rating || 0;
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Ionicons
        key={i}
        name={i <= r ? 'star' : 'star-outline'}
        size={14}
        color={i <= r ? '#FFC107' : theme.border}
      />
    );
  }

  // Fecha legible
  let dateStr = '';
  if (review.date) {
    try {
      const d = new Date(review.date);
      dateStr = d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) {}
  }

  return (
    <View style={[
      styles.reviewItem,
      !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider },
    ]}>
      {/* Fila superior: estrellas + badge de categoría */}
      <View style={styles.itemHeader}>
        <View style={styles.starsRow}>{stars}</View>
        <View style={[styles.categoryBadge, { backgroundColor: catColor + '22', borderColor: catColor }]}>
          <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
          <Text style={[styles.categoryText, { color: catColor }]}>{cat}</Text>
        </View>
      </View>

      {/* Fecha */}
      {dateStr ? (
        <Text style={[styles.date, { color: theme.textSecondary }]}>{dateStr}</Text>
      ) : null}

      {/* Comentario real — siempre visible cuando existe (sea propio o no).
          La clasificación necesita su evidencia; ocultarla sería redundante */}
      {review.comment ? (
        <Text style={[styles.comment, { color: theme.text }]} numberOfLines={compact ? 2 : 5}>
          “{review.comment}”
        </Text>
      ) : (
        // Sin comentario: solo aviso sutil de que la reseña no traía texto
        <Text style={[styles.private, { color: theme.textSecondary }]}>
          Sin comentario.
        </Text>
      )}

      {/* Razón del agente IA — solo visible para el dueño del perfil.
          Es debug interno del LLM, no aporta a quien evalúa al usuario */}
      {isOwn && review.moderation?.reason ? (
        <View style={[styles.moderationBox, { backgroundColor: theme.bg, borderLeftColor: catColor }]}>
          <Text style={[styles.moderationLabel, { color: theme.textSecondary }]}>
            🤖 Decisión del agente:
          </Text>
          <Text style={[styles.moderationReason, { color: theme.text }]}>
            {review.moderation.reason}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  center: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: {
    fontSize: 13,
  },

  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
    marginBottom: 4,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statCount: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    marginRight: 4,
  },
  statLabel: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 11,
    color: '#94a3b8',
  },

  reviewItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  categoryText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 10,
    letterSpacing: 0.3,
  },
  date: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
  },
  comment: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 4,
  },
  moderationBox: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    borderRadius: 6,
  },
  moderationLabel: {
    fontSize: 10,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  moderationReason: {
    fontSize: 12,
    lineHeight: 16,
  },
  private: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
});

export default ReviewsList;
