import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { theme } from '../theme';

let toastRef = null;

export function ToastContainer() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState({ type: 'success', text1: '', text2: '' });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });
  };

  useEffect(() => {
    toastRef = {
      show: (msg) => {
        setMessage(msg);
        setVisible(true);
      },
      hide: hide,
    };
  }, [fadeAnim]);

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        if (toastRef) {
          toastRef.hide();
        }
      }, 3000);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [visible, fadeAnim]);

  if (!visible) return null;

  const getIcon = () => {
    switch (message.type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'alert-circle';
      case 'info':
        return 'info';
      default:
        return 'check-circle';
    }
  };

  const getColor = () => {
    switch (message.type) {
      case 'success':
        return theme.colors.primary;
      case 'error':
        return theme.colors.danger;
      case 'info':
        return theme.colors.accent;
      default:
        return theme.colors.primary;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.toast, { borderLeftColor: getColor() }]}>
        <Feather name={getIcon()} size={20} color={getColor()} />
        <View style={styles.textContainer}>
          {message.text1 ? (
            <Text style={styles.text1}>{message.text1}</Text>
          ) : null}
          {message.text2 ? (
            <Text style={styles.text2}>{message.text2}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={hide} style={styles.closeButton}>
          <Feather name="x" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export const Toast = {
  show: (message) => {
    if (toastRef) {
      toastRef.show(message);
    }
  },
  hide: () => {
    if (toastRef) {
      toastRef.hide();
    }
  },
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.shapes.cardRadius,
    padding: theme.spacing.md,
    borderLeftWidth: 4,
    ...theme.shadow.card,
    gap: theme.spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  text1: {
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  text2: {
    fontFamily: theme.typography.regular,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
});

