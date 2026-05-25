import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  StatusBar,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../../context/DriverThemeContext';
import StarRating from '../../components/StarRating';
import DimensionRater from '../../components/DimensionRater';
import TagPicker from '../../components/TagPicker';
import WizardStepIndicator from '../../components/WizardStepIndicator';
import TripCompletedOverlay from '../../components/TripCompletedOverlay';
import {
  getTagsForReviewee,
  getDimensionsForReviewee,
  OVERALL_LABELS,
} from '../../constants/reputationTags';
import {
  buildSafeScorePayload,
  submitSafeScoreReview,
  SAFESCORE_NOT_IMPLEMENTED,
} from '../../services/safescoreService';

/**
 * SafeScoreReview — pantalla wizard multidimensional post-viaje.
 *
 * Reemplazo evolutivo de RatingScreen. Vive en PARALELO mientras el backend
 * no exponga /reviews/v2. No está conectada al stack de navegación hasta que
 * el backend esté listo.
 *
 * Wizard de 4 pasos:
 *   1. Overall (5 estrellas grandes)
 *   2. Dimensiones específicas según el rol del reviewee (3 dimensiones)
 *   3. Tags estructurados (positivos / negativos)
 *   4. Comentario opcional (solo se exige si hay tags negativos) + envío
 *
 * Props:
 *   rideId         (string)
 *   revieweeId     (string)
 *   reviewerRole   'driver' | 'passenger'   rol del usuario que califica
 *   revieweeRole   'driver' | 'passenger'   rol del usuario calificado
 *   personName     (string)
 *   personImage    (string?) URL foto perfil
 *   title          (string)  título principal del wizard
 *   subtitle       (string)  subtítulo
 *   accentColor    (string)  color principal de botones / progreso
 *   badgeColor     ({ bg, icon })  colores del ícono de completado
 *   onSuccess      () => void
 *   onSkip         () => void
 *   disabled       (boolean)
 */
const SafeScoreReview = ({
  rideId,
  revieweeId,
  reviewerRole = 'passenger',
  revieweeRole = 'driver',
  personName,
  personImage,
  title = 'Califica tu viaje',
  subtitle = 'Tu opinión hace que SafeRide sea más seguro para todos.',
  accentColor = '#4B68FF',
  badgeColor = { bg: '#E0F7FA', icon: '#00838F' },
  onSuccess,
  onSkip,
  disabled = false,
}) => {
  const { theme } = useDriverTheme();

  // ── Estado del wizard ──────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 4;

  const [overall, setOverall] = useState(0);
  const [ratings, setRatings] = useState({});  // { safety: 5, conduction: 4, ... }
  const [positiveTags, setPositiveTags] = useState([]);  // codes
  const [negativeTags, setNegativeTags] = useState([]);
  const [comment, setComment] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Catálogos derivados del rol del calificado ─────────────────────────
  const dimensions = useMemo(() => getDimensionsForReviewee(revieweeRole), [revieweeRole]);
  const tagCatalog = useMemo(() => getTagsForReviewee(revieweeRole), [revieweeRole]);

  // ── Animaciones ────────────────────────────────────────────────────────
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTranslate = useRef(new Animated.Value(0)).current;
  const overallLabelAnim = useRef(new Animated.Value(0)).current;

  // ── Navegación entre pasos ─────────────────────────────────────────────
  const animateStepTransition = (direction = 'forward', after) => {
    Animated.parallel([
      Animated.timing(stepOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(stepTranslate, {
        toValue: direction === 'forward' ? -20 : 20,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      after?.();
      stepTranslate.setValue(direction === 'forward' ? 20 : -20);
      Animated.parallel([
        Animated.timing(stepOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(stepTranslate, {
          toValue: 0,
          friction: 7,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const goNext = () => {
    if (step >= TOTAL_STEPS) return;
    animateStepTransition('forward', () => setStep((s) => s + 1));
  };

  const goBack = () => {
    if (step <= 1) return;
    animateStepTransition('back', () => setStep((s) => s - 1));
  };

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleOverallChange = (value) => {
    setOverall(value);
    overallLabelAnim.setValue(0);
    Animated.spring(overallLabelAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleDimensionChange = (dimKey, value) => {
    setRatings((prev) => ({ ...prev, [dimKey]: value }));
  };

  const togglePositive = (tag) => {
    setPositiveTags((prev) =>
      prev.includes(tag.code) ? prev.filter((c) => c !== tag.code) : [...prev, tag.code]
    );
  };

  const toggleNegative = (tag) => {
    setNegativeTags((prev) =>
      prev.includes(tag.code) ? prev.filter((c) => c !== tag.code) : [...prev, tag.code]
    );
  };

  const handleSubmit = async () => {
    if (overall === 0) {
      Alert.alert('Calificación faltante', 'Selecciona al menos una estrella en el paso 1.');
      setStep(1);
      return;
    }
    if (negativeTags.length > 0 && comment.trim().length < 10) {
      Alert.alert(
        'Cuéntanos un poco más',
        'Cuando marcas aspectos a mejorar, te pedimos un comentario breve (mín. 10 caracteres) para dar contexto al equipo de moderación.'
      );
      return;
    }

    setLoading(true);
    setSubmitError(null);

    const payload = buildSafeScorePayload({
      rideId,
      revieweeId,
      reviewerRole,
      overall,
      ratings,
      positiveTags,
      negativeTags,
      comment: comment.trim() || null,
      location: null,  // TODO: integrar useLocationTracker.getLastKnown() cuando esté listo backend
    });

    try {
      await submitSafeScoreReview(payload);
      setShowSuccess(true);  // se autocierra y dispara onSuccess
    } catch (err) {
      if (err.code === SAFESCORE_NOT_IMPLEMENTED) {
        // Estado esperado mientras backend no expone /reviews/v2.
        // En esta fase damos feedback honesto al usuario.
        setSubmitError(
          'El nuevo sistema de reseñas estará disponible en breve. ' +
          'Tu opinión es importante — guárdala en tu memoria y vuelve a intentar pronto.'
        );
        Alert.alert(
          'Sistema en preparación',
          'SafeScore aún no está conectado. Cuando el backend esté listo, podrás enviar esta reseña.'
        );
      } else {
        const msg = err.response?.data?.message || err.message || 'No se pudo enviar';
        setSubmitError(msg);
        Alert.alert('Error', msg);
      }
      setLoading(false);
    }
  };

  // ── Validaciones de paso ───────────────────────────────────────────────
  const canAdvance = useMemo(() => {
    if (step === 1) return overall > 0;
    if (step === 2) {
      // Al menos 1 dimensión calificada — no obligamos todas (data parcial OK)
      return Object.values(ratings).some((v) => v > 0);
    }
    if (step === 3) {
      // No exigimos tags, son opcionales — siempre se puede avanzar
      return true;
    }
    return true;
  }, [step, overall, ratings]);

  // ── Render por paso ────────────────────────────────────────────────────
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>
        ¿Cómo fue tu viaje en general?
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Una calificación rápida nos ayuda a empezar.
      </Text>

      <StarRating
        value={overall}
        onChange={handleOverallChange}
        emptyColor={theme.border}
        disabled={disabled}
      />

      <Animated.View
        style={{
          opacity: overallLabelAnim,
          transform: [
            {
              scale: overallLabelAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
          minHeight: 24,
          marginTop: 6,
        }}
      >
        {overall > 0 && (
          <Text style={styles.overallLabel}>{OVERALL_LABELS[overall]}</Text>
        )}
      </Animated.View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>
        Detalles del viaje
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Califica los aspectos que más te importaron. Puedes saltar los que no apliquen.
      </Text>

      <View style={styles.dimensionsList}>
        {dimensions.map((dim) => (
          <DimensionRater
            key={dim.key}
            dimension={dim}
            value={ratings[dim.key] || 0}
            onChange={(v) => handleDimensionChange(dim.key, v)}
            color={accentColor}
            disabled={disabled}
          />
        ))}
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: theme.text }]}>
        ¿Qué te marcó del viaje?
      </Text>
      <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
        Toca los aspectos que aplican. Puedes elegir varios o ninguno.
      </Text>

      <TagPicker
        tags={tagCatalog}
        selectedPositive={positiveTags}
        selectedNegative={negativeTags}
        onTogglePositive={togglePositive}
        onToggleNegative={toggleNegative}
        disabled={disabled}
      />
    </View>
  );

  const renderStep4 = () => {
    const needsComment = negativeTags.length > 0;
    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: theme.text }]}>
          {needsComment ? 'Cuéntanos qué pasó' : '¿Algo más que añadir?'}
        </Text>
        <Text style={[styles.stepSubtitle, { color: theme.textSecondary }]}>
          {needsComment
            ? 'Ya que marcaste algo a mejorar, ayúdanos con un poco de contexto. Esta reseña pasará por moderación antes de publicarse.'
            : 'Un comentario es totalmente opcional. Si todo bien, puedes enviar directamente.'}
        </Text>

        <TextInput
          style={[
            styles.commentInput,
            {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: needsComment ? accentColor : theme.border,
              borderWidth: needsComment ? 1.5 : 1,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
          placeholder={
            needsComment
              ? 'Describe brevemente lo que sucedió...'
              : 'Comentario opcional...'
          }
          placeholderTextColor={theme.textSecondary}
          multiline
          numberOfLines={5}
          maxLength={500}
          value={comment}
          editable={!disabled}
          onChangeText={(t) => {
            setComment(t);
            if (submitError) setSubmitError(null);
          }}
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, { color: theme.textSecondary }]}>
          {comment.length}/500
        </Text>

        {/* Resumen */}
        <View style={[styles.summaryBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.summaryTitle, { color: theme.text }]}>Resumen</Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Calificación general</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>
              {overall > 0 ? `${overall} ⭐` : '—'}
            </Text>
          </View>
          {Object.keys(ratings).length > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Dimensiones</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {Object.keys(ratings).length} calificada{Object.keys(ratings).length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {(positiveTags.length > 0 || negativeTags.length > 0) && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Etiquetas</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {positiveTags.length}✓ · {negativeTags.length}⚠
              </Text>
            </View>
          )}
        </View>

        {submitError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#C62828" />
            <Text style={styles.errorText}>{submitError}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderStepBody = () => {
    if (step === 1) return renderStep1();
    if (step === 2) return renderStep2();
    if (step === 3) return renderStep3();
    return renderStep4();
  };

  // ── Render principal ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      <TripCompletedOverlay
        visible={showSuccess}
        theme={theme}
        onFinish={() => {
          setShowSuccess(false);
          onSuccess?.();
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header — ícono + título + reviewee */}
        <View style={[styles.iconBadge, { backgroundColor: badgeColor.bg }]}>
          <Ionicons name="shield-checkmark" size={36} color={badgeColor.icon} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>

        {/* Avatar reviewee — compacto, siempre visible */}
        <View style={styles.personRow}>
          {personImage ? (
            <Image source={{ uri: personImage }} style={styles.avatarSmall} />
          ) : (
            <View
              style={[styles.avatarSmall, styles.avatarPlaceholder, { backgroundColor: theme.border }]}
            >
              <Ionicons name="person" size={22} color={theme.textSecondary} />
            </View>
          )}
          <View>
            <Text style={[styles.personName, { color: theme.text }]} numberOfLines={1}>
              {personName || (revieweeRole === 'driver' ? 'Tu conductor' : 'Tu pasajero')}
            </Text>
            <Text style={[styles.personRole, { color: theme.textSecondary }]}>
              {revieweeRole === 'driver' ? 'CONDUCTOR' : 'PASAJERO'}
            </Text>
          </View>
        </View>

        {/* Step indicator */}
        <WizardStepIndicator
          currentStep={step}
          totalSteps={TOTAL_STEPS}
          accentColor={accentColor}
          stepLabels={['General', 'Detalles', 'Etiquetas', 'Enviar']}
        />

        {/* Step body animado */}
        <Animated.View
          style={{
            opacity: stepOpacity,
            transform: [{ translateX: stepTranslate }],
            width: '100%',
          }}
        >
          {renderStepBody()}
        </Animated.View>

        {/* Footer — navegación */}
        <View style={styles.footerRow}>
          {step > 1 ? (
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: theme.border, backgroundColor: theme.surface }]}
              onPress={goBack}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Ionicons name="chevron-back" size={18} color={theme.text} />
              <Text style={[styles.btnSecondaryText, { color: theme.text }]}>Atrás</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: theme.border, backgroundColor: theme.surface }]}
              onPress={onSkip}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text style={[styles.btnSecondaryText, { color: theme.text }]}>Omitir</Text>
            </TouchableOpacity>
          )}

          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[
                styles.btnPrimary,
                {
                  backgroundColor: accentColor,
                  opacity: canAdvance ? 1 : 0.5,
                },
              ]}
              onPress={goNext}
              activeOpacity={0.85}
              disabled={!canAdvance || loading}
            >
              <Text style={styles.btnPrimaryText}>Siguiente</Text>
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: accentColor, opacity: loading ? 0.7 : 1 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.btnPrimaryText}>Enviar reseña</Text>
                  <Ionicons name="paper-plane" size={16} color="#FFF" style={{ marginLeft: 4 }} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Nota legal / contexto sutil */}
        {step === TOTAL_STEPS && (
          <Text style={[styles.footnote, { color: theme.textSecondary }]}>
            🔒 Tu reseña es privada hasta que ambos califiquen (máx. 24 h). Esto previene reacciones impulsivas y protege a las dos partes.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  content: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 40,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 14,
  },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  personName: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    maxWidth: 200,
  },
  personRole: {
    fontSize: 10,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.5,
    marginTop: -2,
  },
  stepContent: {
    width: '100%',
    marginTop: 18,
    minHeight: 220,
  },
  stepTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  overallLabel: {
    fontSize: 17,
    fontFamily: 'Poppins-Bold',
    color: '#FFC107',
    marginTop: 6,
    textAlign: 'center',
  },
  dimensionsList: {
    width: '100%',
  },
  commentInput: {
    width: '100%',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    minHeight: 100,
    marginTop: 4,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  summaryBox: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 4,
  },
  summaryTitle: {
    fontSize: 13,
    fontFamily: 'Poppins-Bold',
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryValue: {
    fontSize: 13,
    fontFamily: 'Poppins-Bold',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: '#FFEBEE',
  },
  errorText: {
    color: '#C62828',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 22,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    marginLeft: 2,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    height: 48,
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
    marginRight: 4,
  },
  footnote: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});

export default SafeScoreReview;
