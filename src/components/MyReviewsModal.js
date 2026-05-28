import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity,
  ActivityIndicator, SafeAreaView, StatusBar, Animated, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../context/DriverThemeContext';
import { getUserReviews } from '../services/safescoreService';

/**
 * MyReviewsModal — modal full-screen para que el usuario vea TODAS sus reseñas
 *                  recibidas (con comentario y razón del agente), con paginación.
 *
 * Diseñado para reemplazar el bloque inline de "MIS RESEÑAS" que estaba en
 * PasajeroProfileScreen y ProfileConductor — sobrecargaba la pantalla cuando
 * el usuario tenía muchas reseñas. Esta versión:
 *
 *   - Carga 10 reseñas inicialmente
 *   - Botón "Ver más" carga 10 adicionales
 *   - Las acumula en la misma lista (no descarta las anteriores)
 *   - Cuando no hay más, oculta el botón y muestra "No hay más reseñas"
 *   - Anónimo: el backend ya no expone reviewer_id, solo se ven los comentarios
 *
 * Props:
 *   visible  (boolean)  — controla la apertura del modal
 *   userId   (string)   — id del usuario cuyas reseñas se cargan (el dueño)
 *   onClose  () => void — callback al cerrar (X o botón atrás)
 *   title    (string?)  — título del header. Default: "Tus reseñas"
 */
const PAGE_SIZE = 10;

const MyReviewsModal = ({ visible, userId, onClose, title = 'Tus reseñas' }) => {
  const { theme } = useDriverTheme();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  // Animación de entrada del modal (slide-up)
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  // Reset al abrir
  useEffect(() => {
    if (visible && userId) {
      setReviews([]);
      setPage(1);
      setHasMore(true);
      setError(null);
      loadPage(1, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId]);

  const loadPage = useCallback(async (pageToLoad, isInitial = false) => {
    if (!userId) return;
    if (isInitial) setLoadingInitial(true);
    else setLoadingMore(true);

    try {
      const result = await getUserReviews(userId, { limit: PAGE_SIZE, page: pageToLoad });
      const newReviews = result?.data || [];
      const total = result?.stats?.total ?? 0;

      setReviews(prev => isInitial ? newReviews : [...prev, ...newReviews]);
      if (isInitial) setStats(result?.stats || null);

      // Determinar si hay más para cargar
      const loadedSoFar = isInitial ? newReviews.length : (reviews.length + newReviews.length);
      setHasMore(loadedSoFar < total && newReviews.length === PAGE_SIZE);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'No se pudieron cargar las reseñas';
      setError(msg);
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  }, [userId, reviews.length]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadPage(next, false);
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.divider }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.accent }]}>{title}</Text>
          <View style={styles.headerBtn} />
        </View>

        {/* Contenido */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={true}
        >
          {/* Stats arriba */}
          {stats && stats.total > 0 ? (
            <View style={[styles.statsCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
              <Text style={[styles.statsTitle, { color: theme.text }]}>
                Has recibido {stats.total} {stats.total === 1 ? 'reseña' : 'reseñas'}
              </Text>
              <View style={styles.statsRow}>
                {stats.satisfecho > 0 && <StatBadge count={stats.satisfecho} label="Satisfechas" color="#16a34a" />}
                {stats.regular > 0 && <StatBadge count={stats.regular} label="Regulares" color="#eab308" />}
                {stats.toxica > 0 && <StatBadge count={stats.toxica} label="Tóxicas" color="#dc2626" />}
                {stats.pendiente > 0 && <StatBadge count={stats.pendiente} label="Pendientes" color={theme.textSecondary} />}
              </View>
              {stats.avg_rating ? (
                <Text style={[styles.avgRating, { color: theme.textSecondary }]}>
                  Calificación promedio: ⭐ {stats.avg_rating.toFixed(2)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Loading inicial */}
          {loadingInitial && reviews.length === 0 ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={[styles.mutedText, { color: theme.textSecondary, marginTop: 12 }]}>
                Cargando tus reseñas...
              </Text>
            </View>
          ) : null}

          {/* Error */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
              <Ionicons name="alert-circle-outline" size={20} color="#B91C1C" />
              <Text style={{ color: '#B91C1C', marginLeft: 8, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          {/* Empty state */}
          {!loadingInitial && !error && reviews.length === 0 ? (
            <View style={styles.centerBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Aún no tienes reseñas</Text>
              <Text style={[styles.mutedText, { color: theme.textSecondary, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }]}>
                Cuando completes viajes y los demás te califiquen, aparecerán aquí con su clasificación del sistema.
              </Text>
            </View>
          ) : null}

          {/* Lista de reseñas */}
          {reviews.map((r, idx) => (
            <ReviewCard key={r._id?.toString() || idx} review={r} theme={theme} />
          ))}

          {/* Botón "Ver más" */}
          {reviews.length > 0 && hasMore ? (
            <TouchableOpacity
              style={[styles.loadMoreBtn, { backgroundColor: theme.accent, opacity: loadingMore ? 0.6 : 1 }]}
              onPress={handleLoadMore}
              disabled={loadingMore}
              activeOpacity={0.85}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="chevron-down" size={18} color="#FFF" />
                  <Text style={styles.loadMoreText}>Ver más reseñas</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {/* No hay más */}
          {reviews.length > 0 && !hasMore ? (
            <Text style={[styles.endText, { color: theme.textSecondary }]}>
              — No hay más reseñas —
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ── Subcomponente: Stat badge ────────────────────────────────────────────
const StatBadge = ({ count, label, color }) => (
  <View style={styles.statBadge}>
    <View style={[styles.statDot, { backgroundColor: color }]} />
    <Text style={[styles.statCount, { color }]}>{count}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ── Subcomponente: Review card ────────────────────────────────────────────
const ReviewCard = ({ review, theme }) => {
  const cat = review.moderation?.category || 'Pendiente';
  const catColor = review.moderation?.color || '#94a3b8';

  // Estrellas
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

  // Fecha
  let dateStr = '';
  if (review.date) {
    try {
      dateStr = new Date(review.date).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) {}
  }

  return (
    <View style={[styles.reviewCard, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
      {/* Header: estrellas + badge */}
      <View style={styles.cardHeader}>
        <View style={styles.starsRow}>{stars}</View>
        <View style={[styles.categoryBadge, { backgroundColor: catColor + '22', borderColor: catColor }]}>
          <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
          <Text style={[styles.categoryText, { color: catColor }]}>{cat}</Text>
        </View>
      </View>

      {/* Fecha */}
      {dateStr ? (
        <Text style={[styles.dateText, { color: theme.textSecondary }]}>{dateStr}</Text>
      ) : null}

      {/* Comentario */}
      {review.comment ? (
        <Text style={[styles.commentText, { color: theme.text }]}>
          “{review.comment}”
        </Text>
      ) : (
        <Text style={[styles.noCommentText, { color: theme.textSecondary }]}>Sin comentario.</Text>
      )}

      {/* Razón del agente (solo si la API la devolvió, que pasa cuando es el dueño) */}
      {review.moderation?.reason ? (
        <View style={[styles.reasonBox, { backgroundColor: theme.bg, borderLeftColor: catColor }]}>
          <Text style={[styles.reasonLabel, { color: theme.textSecondary }]}>
            🤖 Decisión del agente
          </Text>
          <Text style={[styles.reasonText, { color: theme.text }]}>
            {review.moderation.reason}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Poppins-Bold',
    letterSpacing: 0.3,
  },

  statsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  statsTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBadge: {
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
  avgRating: {
    fontSize: 12,
    marginTop: 8,
  },

  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedText: {
    fontSize: 13,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },

  reviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
  dateText: {
    fontSize: 11,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 6,
  },
  commentText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 19,
    marginTop: 4,
  },
  noCommentText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  reasonBox: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    borderRadius: 6,
  },
  reasonLabel: {
    fontSize: 10,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  reasonText: {
    fontSize: 12,
    lineHeight: 16,
  },

  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  loadMoreText: {
    color: '#FFF',
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    marginLeft: 6,
  },
  endText: {
    textAlign: 'center',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 16,
  },
});

export default MyReviewsModal;
