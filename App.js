import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { Toast, ToastContainer } from './src/components/Toast';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { theme } from './src/theme';
import { pantryItems as initialPantryItems, recipes } from './src/data/mockData';
import { fetchPantryItems, createPantryItem, deletePantryItem, updatePantryItem } from './src/services/aiService';
import {
  scheduleExpiryNotifications,
  checkAndUpdateExpiryStatus,
  requestNotificationPermissions,
} from './src/services/notificationService';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { AddItemScreen } from './src/screens/AddItemScreen';
import { EditItemScreen } from './src/screens/EditItemScreen';
import { RecipesScreen } from './src/screens/RecipesScreen';
import { StatisticsScreen } from './src/screens/StatisticsScreen';
import { BottomNav } from './src/components/BottomNav';

const tabs = ['Home', 'Add', 'Stats'];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authScreen, setAuthScreen] = useState('Login'); // 'Login', 'SignUp', 'ForgotPassword'
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('Home');
  const [pantryItems, setPantryItems] = useState(initialPantryItems);
  const [pantryLoading, setPantryLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const loadPantry = async () => {
    try {
      setPantryLoading(true);
      const items = await fetchPantryItems();
      // Update status based on expiry dates (backend also does this, but frontend ensures consistency)
      const itemsWithStatus = checkAndUpdateExpiryStatus(items);
      setPantryItems(itemsWithStatus);
      
      // Schedule notifications for expiring items
      await scheduleExpiryNotifications(itemsWithStatus);
    } catch (error) {
      console.error('Failed to load pantry items', error);
      Toast.show({
        type: 'error',
        text1: 'Pantry Error',
        text2: error?.message || 'Unable to load your pantry items.',
      });
    } finally {
      setPantryLoading(false);
    }
  };

  const persistUser = (userData) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('freshtrack_user', JSON.stringify(userData));
      } catch {
        // ignore storage errors
      }
    }
  };

  const clearPersistedUser = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem('freshtrack_user');
      } catch {
        // ignore storage errors
      }
    }
  };

  const handleLogin = async (userData) => {
    setUser(userData);
    setScreen('Home'); // Ensure we go to Home screen (Dashboard)
    setIsAuthenticated(true);
    persistUser(userData);
    await loadPantry();
    Toast.show({
      type: 'success',
      text1: 'Welcome back!',
      text2: `Signed in as ${userData.name}`,
    });
  };

  const handleSignUp = async (userData) => {
    setUser(userData);
    setScreen('Home'); // Ensure we go to Home screen (Dashboard)
    setIsAuthenticated(true);
    persistUser(userData);
    await loadPantry();
    Toast.show({
      type: 'success',
      text1: 'Account Created',
      text2: 'Welcome to FreshTrack!',
    });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setScreen('Home');
    setAuthScreen('Login');
    clearPersistedUser();
    Toast.show({
      type: 'info',
      text1: 'Signed Out',
      text2: 'You have been successfully signed out',
    });
  };

  const handleAddItem = async (newItem) => {
    try {
      setPantryLoading(true);
      // Backend will calculate status automatically, but we don't pass status here
      const created = await createPantryItem(newItem);
      const updatedItems = [...pantryItems, created];
      // Ensure status is calculated on frontend too
      const itemsWithStatus = checkAndUpdateExpiryStatus(updatedItems);
      setPantryItems(itemsWithStatus);
      // Schedule notifications for the new item
      await scheduleExpiryNotifications(itemsWithStatus);
      setScreen('Home');
      Toast.show({
        type: 'success',
        text1: 'Item Added',
        text2: `${newItem.name} has been added to your pantry`,
      });
    } catch (error) {
      console.error('Failed to add pantry item', error);
      Toast.show({
        type: 'error',
        text1: 'Add Failed',
        text2: error?.message || 'Unable to add this item.',
      });
    } finally {
      setPantryLoading(false);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setScreen('Edit');
  };

  const handleUpdateItem = async (updatedItem) => {
    if (!editingItem) return;

    try {
      setPantryLoading(true);
      const updated = await updatePantryItem(editingItem.id, updatedItem);
      setPantryItems((prev) =>
        prev.map((item) => (item.id === editingItem.id ? { ...updated, id: String(updated.id) } : item))
      );
      // Update status and notifications
      const itemsWithStatus = checkAndUpdateExpiryStatus(pantryItems.map(item => 
        item.id === editingItem.id ? updated : item
      ));
      setPantryItems(itemsWithStatus);
      await scheduleExpiryNotifications(itemsWithStatus);
      setEditingItem(null);
      setScreen('Home');
      Toast.show({
        type: 'success',
        text1: 'Item Updated',
        text2: `${updatedItem.name} has been updated`,
      });
    } catch (error) {
      console.error('Failed to update pantry item', error);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error?.message || 'Unable to update this item.',
      });
    } finally {
      setPantryLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    const item = pantryItems.find((i) => i.id === itemId);
    // Optimistic update
    setPantryItems((prev) => prev.filter((it) => it.id !== itemId));
    try {
      await deletePantryItem(itemId);
      Toast.show({
        type: 'success',
        text1: 'Item Deleted',
        text2: `${item?.name || 'Item'} has been removed`,
      });
    } catch (error) {
      console.error('Failed to delete pantry item', error);
      // Revert if delete failed
      setPantryItems((prev) => [...prev, item].filter(Boolean));
      Toast.show({
        type: 'error',
        text1: 'Delete Failed',
        text2: error?.message || 'Unable to delete this item.',
      });
    }
  };

  // Request notification permissions on app start
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Auto-restore session on web refresh if a user was persisted
  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      const raw = window.localStorage.getItem('freshtrack_user');
      if (raw) {
        const storedUser = JSON.parse(raw);
        if (storedUser && storedUser.email) {
          setUser(storedUser);
          setIsAuthenticated(true);
          setScreen('Home');
          loadPantry();
        }
      }
    } catch {
      // ignore parse/storage errors
    }
  }, []);

  // Periodic check for expiry status updates (every 5 minutes when app is active)
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkExpiryInterval = setInterval(() => {
      // Update status for all items using functional update to avoid dependency
      setPantryItems((currentItems) => {
        const updatedItems = checkAndUpdateExpiryStatus(currentItems);
        scheduleExpiryNotifications(updatedItems);
        return updatedItems;
      });
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Also check when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setPantryItems((currentItems) => {
          const updatedItems = checkAndUpdateExpiryStatus(currentItems);
          scheduleExpiryNotifications(updatedItems);
          return updatedItems;
        });
      }
    });

    return () => {
      clearInterval(checkExpiryInterval);
      subscription?.remove();
    };
  }, [isAuthenticated]);

  const renderAuthScreen = () => {
    switch (authScreen) {
      case 'SignUp':
        return (
          <SignUpScreen
            onBack={() => setAuthScreen('Login')}
            onSignUp={handleSignUp}
          />
        );
      case 'ForgotPassword':
        return (
          <ForgotPasswordScreen
            onBack={() => setAuthScreen('Login')}
            onResetPassword={() => setAuthScreen('Login')}
          />
        );
      case 'Login':
      default:
        return (
          <LoginScreen
            onLogin={handleLogin}
            onSignUp={() => setAuthScreen('SignUp')}
            onForgotPassword={() => setAuthScreen('ForgotPassword')}
          />
        );
    }
  };

  const renderScreen = () => {
    switch (screen) {
      case 'Add':
        return <AddItemScreen onAddItem={handleAddItem} onCancel={() => setScreen('Home')} />;
      case 'Edit':
        return (
          <EditItemScreen
            item={editingItem}
            onUpdate={handleUpdateItem}
            onCancel={() => {
              setEditingItem(null);
              setScreen('Home');
            }}
          />
        );
      case 'Stats':
        return <StatisticsScreen />;
      case 'Recipes':
        return (
          <RecipesScreen
            data={recipes}
            pantryItems={pantryItems}
            onBack={() => setScreen('Home')}
          />
        );
      case 'Home':
      default:
        return (
          <HomeScreen
            items={pantryItems}
            user={user}
            onViewRecipes={() => setScreen('Recipes')}
            onLogout={handleLogout}
            onDeleteItem={handleDeleteItem}
            onEditItem={handleEditItem}
          />
        );
    }
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        {renderAuthScreen()}
        <ToastContainer />
      </SafeAreaView>
    );
  }

  const activeTab = tabs.includes(screen) ? screen : 'Home';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>{renderScreen()}</View>
      <View style={styles.navWrapper}>
        <BottomNav tabs={tabs} activeTab={activeTab} onChange={setScreen} />
      </View>
      <ToastContainer />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  navWrapper: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
