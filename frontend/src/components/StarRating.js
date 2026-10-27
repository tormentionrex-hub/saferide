import React, { useRef } from 'react';
import { View, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * StarRating — componente puro de estrellas con animaciones micro-interactivas.
 */
const StarRating = ({
    value = 0,
    onChange,
    size = 46,
    color = '#FFC107',
    emptyColor = '#D0D0D0',
    disabled = false,
}) => {
    // Escalas individuales para cada estrella
    const scales = [
        useRef(new Animated.Value(1)).current,
        useRef(new Animated.Value(1)).current,
        useRef(new Animated.Value(1)).current,
        useRef(new Animated.Value(1)).current,
        useRef(new Animated.Value(1)).current,
    ];

    const animateScale = (index, toValue) => {
        Animated.spring(scales[index], {
            toValue,
            friction: 4,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    const handlePressIn = (index) => {
        if (!disabled) animateScale(index, 0.85);
    };

    const handlePressOut = (index) => {
        if (!disabled) animateScale(index, 1);
    };

    const handlePress = (star) => {
        if (!disabled) {
            onChange?.(star);
            // Pequeño efecto de "pop" al seleccionar
            Animated.sequence([
                Animated.timing(scales[star - 1], {
                    toValue: 1.25,
                    duration: 100,
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
        }
    };

    return (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 10 }}>
            {[1, 2, 3, 4, 5].map((star, index) => (
                <Animated.View
                    key={star}
                    style={{ transform: [{ scale: scales[index] }] }}
                >
                    <TouchableOpacity
                        onPress={() => handlePress(star)}
                        onPressIn={() => handlePressIn(index)}
                        onPressOut={() => handlePressOut(index)}
                        activeOpacity={1}
                        disabled={disabled}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                    >
                        <Ionicons
                            name={star <= value ? 'star' : 'star-outline'}
                            size={size}
                            color={star <= value ? color : emptyColor}
                            style={{ marginHorizontal: 6 }}
                        />
                    </TouchableOpacity>
                </Animated.View>
            ))}
        </View>
    );
};

export default StarRating;
