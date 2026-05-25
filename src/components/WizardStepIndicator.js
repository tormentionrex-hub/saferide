import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useDriverTheme } from '../context/DriverThemeContext';

/**
 * WizardStepIndicator — barra de progreso para wizards multi-paso.
 *
 * Muestra dots conectados con una barra de progreso animada que se rellena
 * según el paso actual.
 *
 * Props:
 *   currentStep   (number)   paso actual, 1-indexed
 *   totalSteps    (number)   total de pasos
 *   accentColor   (string)   color de los pasos completados
 *   stepLabels    (string[]) labels opcionales para mostrar bajo cada dot
 */
const WizardStepIndicator = ({
  currentStep = 1,
  totalSteps = 4,
  accentColor = '#4B68FF',
  stepLabels,
}) => {
  const { theme } = useDriverTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = (currentStep - 1) / Math.max(totalSteps - 1, 1);
    Animated.timing(progress, {
      toValue: target,
      duration: 320,
      useNativeDriver: false, // width interpolada
    }).start();
  }, [currentStep, totalSteps, progress]);

  const widthInterpolated = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.trackRow}>
        {/* Línea de fondo */}
        <View style={[styles.trackBg, { backgroundColor: theme.border }]} />
        {/* Línea de progreso */}
        <Animated.View
          style={[
            styles.trackProgress,
            { backgroundColor: accentColor, width: widthInterpolated },
          ]}
        />

        {/* Dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const stepNum = idx + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            return (
              <View
                key={stepNum}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      isCompleted || isCurrent ? accentColor : theme.surface,
                    borderColor:
                      isCompleted || isCurrent ? accentColor : theme.border,
                    borderWidth: isCurrent ? 3 : 2,
                    transform: [{ scale: isCurrent ? 1.15 : 1 }],
                  },
                ]}
              >
                {isCompleted && <Text style={styles.dotCheck}>✓</Text>}
              </View>
            );
          })}
        </View>
      </View>

      {Array.isArray(stepLabels) && stepLabels.length === totalSteps && (
        <View style={styles.labelsRow}>
          {stepLabels.map((label, idx) => (
            <Text
              key={idx}
              style={[
                styles.label,
                {
                  color:
                    idx + 1 <= currentStep ? theme.text : theme.textSecondary,
                  fontFamily:
                    idx + 1 === currentStep ? 'Poppins-Bold' : 'Poppins-SemiBold',
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ))}
        </View>
      )}

      <Text style={[styles.counterText, { color: theme.textSecondary }]}>
        Paso {currentStep} de {totalSteps}
      </Text>
    </View>
  );
};

const DOT_SIZE = 22;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 8,
  },
  trackRow: {
    height: DOT_SIZE,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBg: {
    position: 'absolute',
    left: DOT_SIZE / 2,
    right: DOT_SIZE / 2,
    height: 3,
    borderRadius: 2,
  },
  trackProgress: {
    position: 'absolute',
    left: DOT_SIZE / 2,
    height: 3,
    borderRadius: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotCheck: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  label: {
    fontSize: 11,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  counterText: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.3,
  },
});

export default WizardStepIndicator;
