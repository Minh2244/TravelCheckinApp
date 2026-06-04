import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
    user_id: number;
    email: string;
    phone: string | null;
    full_name: string;
    role: 'user' | 'owner' | 'employee' | 'admin';
    avatar_url: string | null;
    is_verified: number;
}

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