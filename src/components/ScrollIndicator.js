/**
 * ScrollIndicator — componente reutilizable de indicador de scroll animado.
 *
 * Uso:
 *   const si = useScrollIndicator();
 *
 *   <View style={{ flex: 1 }}>
 *       <ScrollView {...si.scrollProps}>...</ScrollView>
 *       <ScrollIndicator si={si} thumbColor="#4B68FF" />
 *   </View>
 *
 * Para FlatList usa exactamente los mismos props:
 *   <FlatList {...si.scrollProps} data={...} ... />
 */

import { useRef, useCallback, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const TRACK_H     = 120;
const INDICATOR_H = 36;

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useScrollIndicator = () => {
    const scrollY   = useRef(new Animated.Value(0)).current;
    const opacity   = useRef(new Animated.Value(0)).current;
    const fadeTimer = useRef(null);

    // useState para que al conocer las dimensiones se recalcule la interpolación
    const [contentH, setContentH] = useState(1);
    const [viewH,    setViewH]    = useState(1);

    const showIndicator = useCallback(() => {
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        Animated.timing(opacity, {
            toValue: 1, duration: 150, useNativeDriver: true,
        }).start();
        fadeTimer.current = setTimeout(() => {
            Animated.timing(opacity, {
                toValue: 0, duration: 600, useNativeDriver: true,
            }).start();
        }, 1200);
    }, []);

    const scrollProps = {
        scrollEventThrottle: 16,
        showsVerticalScrollIndicator: false,
        onScroll: Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false, listener: showIndicator }
        ),
        onContentSizeChange: (_, h) => setContentH(h),
        onLayout: (e) => setViewH(e.nativeEvent.layout.height),
    };

    return { scrollY, opacity, contentH, viewH, scrollProps };
};

// ── Componente visual ─────────────────────────────────────────────────────────
const ScrollIndicator = ({ si, thumbColor = '#4B68FF' }) => {
    const { scrollY, opacity, contentH, viewH } = si;

    const maxScroll = Math.max(1, contentH - viewH);

    const indicatorTop = scrollY.interpolate({
        inputRange:  [0, maxScroll],
        outputRange: [0, TRACK_H - INDICATOR_H],
        extrapolate: 'clamp',
    });

    return (
        <Animated.View style={[styles.track, { opacity }]}>
            <Animated.View
                style={[
                    styles.thumb,
                    { backgroundColor: thumbColor, transform: [{ translateY: indicatorTop }] },
                ]}
            />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    track: {
        width: 4,
        height: TRACK_H,
        borderRadius: 2,
        backgroundColor: 'rgba(150,150,180,0.15)',
        position: 'absolute',
        right: 4,
        top: '20%',
        overflow: 'hidden',
        zIndex: 99,
    },
    thumb: {
        width: 4,
        height: INDICATOR_H,
        borderRadius: 2,
    },
});

export default ScrollIndicator;
