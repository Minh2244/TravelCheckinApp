import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: User | null;
    isSessionRevoked: boolean;
    setAuth: (accessToken: string, refreshToken: string, user: User) => void;
    logout: () => void;
    setSessionRevoked: (revoked: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            accessToken: null,
            refreshToken: null,
            user: null,
            isSessionRevoked: false,
            setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user, isSessionRevoked: false }),
            logout: () => set({ accessToken: null, refreshToken: null, user: null, isSessionRevoked: false }),
            setSessionRevoked: (revoked) => set({ isSessionRevoked: revoked }),
        }),
        {
            name: 'travelcheckin-auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);