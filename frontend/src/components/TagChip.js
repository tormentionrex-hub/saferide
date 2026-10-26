import React, { useRef } from 'react';
import { Text, StyleSheet, Animated, TouchableOpacity, Easing } from 'react-native';
import { useDriverTheme } from '../context/DriverThemeContext';

/**
 * TagChip — chip individual de un tag de reputación.
 *
 * Props:
 *   tag       { code, label, emoji, dimension }
 *   selected  (boolean)
 *   variant   'positive' | 'negative'   define el color cuando está activo
 *   onPress   () => void
 *   disabled  (boolean)
 */
const POSITIVE_BG_ACTIVE   = '#E8F5E9';  // verde suave
const POSITIVE_TXT_ACTIVE  = '#1B5E20';
const POSITIVE_BORDER_ACT  = '#2E7D32';

const NEGATIVE_BG_ACTIVE   = '#FFEBEE';  // rojo suave
const NEGATIVE_TXT_ACTIVE  = '#B71C1C';
const NEGATIVE_BORDER_ACT  = '#C62828';

const TagChip = ({
  tag,
  selected = false,
  variant = 'positive',
  onPress,
  disabled = false,
}) => {
  const { theme } = useDriverTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled) return;
    onPress?.(tag);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.92,
        duration: 80,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Color resuelto según variant y estado
  let bg, txt, border;
  if (selected) {
    if (variant === 'positive') {
      bg = POSITIVE_BG_ACTIVE;
      txt = POSITIVE_TXT_ACTIVE;
      border = POSITIVE_BORDER_ACT;
    } else {
      bg = NEGATIVE_BG_ACTIVE;
      txt = NEGATIVE_TXT_ACTIVE;
      border = NEGATIVE_BORDER_ACT;
    }
  } else {
    bg = theme.surface;
    txt = theme.text;
    border = theme.border;
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        disabled={disabled}
        style={[
          styles.chip,
          {
            backgroundColor: bg,
            borderColor: border,
            borderWidth: selected ? 1.5 : 1,
          },
        ]}
      >
        <Text style={styles.emoji}>{tag.emoji}</Text>
        <Text style={[styles.label, { color: txt }]} numberOfLines={1}>
          {tag.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: 8,
    marginBottom: 8,
  },
  emoji: {
    fontSize: 15,
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
  },
});

export default TagChip;
