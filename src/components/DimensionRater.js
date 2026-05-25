import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDriverTheme } from '../context/DriverThemeContext';

/**
 * DimensionRater — calificador individual de una dimensión SafeScore.
 *
 * Más compacto que StarRating: una fila con emoji, etiqueta de la dimensión,
 * descripción corta y 5 estrellas en línea. Pensado para combinarse en
 * grupos de 3 dentro del wizard de SafeScoreReview.
 *
 * Props:
 *   dimension     { key, label, description, emoji }
 *   value         (number 1-5 | 0)   selección actual
 *   onChange      (number) => void
 *   color         (string)           color de la estrella seleccionada
 *   disabled      (boolean)
 */
const DimensionRater = ({
  dimension,
  value = 0,
  onChange,
  color = '#FFC107',
  disabled = false,
}) => {
  const { theme } = useDriverTheme();
  const scales = [
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
    useRef(new Animated.Value(1)).current,
  ];

  const rowOpacity = useRef(new Animated.Value(0)).current;
  const rowTranslate = useRef(new Animated.Value(8)).current;

  // Entrada animada (fade + slide-up) cuando el componente aparece
  useEffect(() => {
    Animated.parallel([
      Animated.timing(rowOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.spring(rowTranslate, {
        toValue: 0,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [rowOpacity, rowTranslate]);

  const handlePress = (star) => {
    if (disabled) return;
    onChange?.(star);
    Animated.sequence([
      Animated.timing(scales[star - 1], {
        toValue: 1.3,
        duration: 90,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scales[star - 1], {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: value > 0 ? `${color}40` : theme.border,
          opacity: rowOpacity,
          transform: [{ translateY: rowTranslate }],
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.emoji}>{dimension.emoji}</Text>
        <View style={styles.textBlock}>
          <Text style={[styles.label, { color: theme.text }]}>{dimension.label}</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {dimension.description}
          </Text>
        </View>
      </View>

      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Animated.View key={star} style={{ transform: [{ scale: scales[star - 1] }] }}>
            <TouchableOpacity
              onPress={() => handlePress(star)}
              activeOpacity={0.7}
              disabled={disabled}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Ionicons
                name={star <= value ? 'star' : 'star-outline'}
                size={28}
                color={star <= value ? color : theme.border}
                style={{ marginHorizontal: 3 }}
              />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  emoji: {
    fontSize: 26,
    marginRight: 12,
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DimensionRater;
