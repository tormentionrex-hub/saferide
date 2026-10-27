import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDriverTheme } from '../context/DriverThemeContext';
import TagChip from './TagChip';

/**
 * TagPicker — grilla de chips de tags positivos y negativos.
 *
 * Props:
 *   tags          { positive: Tag[], negative: Tag[] }
 *   selectedPositive  string[]  códigos de tags positivos seleccionados
 *   selectedNegative  string[]  códigos de tags negativos seleccionados
 *   onTogglePositive  (tag) => void
 *   onToggleNegative  (tag) => void
 *   disabled      (boolean)
 *   showCounts    (boolean)  muestra "Seleccionados: X" debajo de cada grupo
 */
const TagPicker = ({
  tags,
  selectedPositive = [],
  selectedNegative = [],
  onTogglePositive,
  onToggleNegative,
  disabled = false,
  showCounts = true,
}) => {
  const { theme } = useDriverTheme();

  const hasPositive = tags?.positive?.length > 0;
  const hasNegative = tags?.negative?.length > 0;

  return (
    <View style={styles.container}>
      {hasPositive && (
        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={[styles.groupTitle, { color: theme.text }]}>
              ✅  ¿Qué te gustó?
            </Text>
            {showCounts && selectedPositive.length > 0 && (
              <Text style={[styles.groupCount, { color: theme.textSecondary }]}>
                {selectedPositive.length} seleccionado{selectedPositive.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <View style={styles.chipsWrap}>
            {tags.positive.map((tag) => (
              <TagChip
                key={tag.code}
                tag={tag}
                variant="positive"
                selected={selectedPositive.includes(tag.code)}
                onPress={onTogglePositive}
                disabled={disabled}
              />
            ))}
          </View>
        </View>
      )}

      {hasNegative && (
        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={[styles.groupTitle, { color: theme.text }]}>
              ⚠️  ¿Algo que mejorar?
            </Text>
            {showCounts && selectedNegative.length > 0 && (
              <Text style={[styles.groupCount, { color: theme.textSecondary }]}>
                {selectedNegative.length} seleccionado{selectedNegative.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <View style={styles.chipsWrap}>
            {tags.negative.map((tag) => (
              <TagChip
                key={tag.code}
                tag={tag}
                variant="negative"
                selected={selectedNegative.includes(tag.code)}
                onPress={onToggleNegative}
                disabled={disabled}
              />
            ))}
          </View>
          {selectedNegative.length > 0 && (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              💡 Podrás añadir un comentario en el siguiente paso para dar contexto.
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  group: {
    marginBottom: 18,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  groupTitle: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
  },
  groupCount: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});

export default TagPicker;
