import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const axiosClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

axiosClient.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().accessToken;
        console.log(`🔑 [Request Interceptor] URL: ${config.url}, State Token: ${token ? token.substring(0, 15) + '...' : 'NULL'}`);
        if (token) {
            config.headers = config.headers || {};
            if (typeof config.headers.set === 'function') {
                config.headers.set('Authorization', `Bearer ${token}`);
            } else {
                (config.headers as any)['Authorization'] = `Bearer ${token}`;
            }
            
            // Đọc lại header để log xác nhận
            const attachedHeader = typeof config.headers.get === 'function' 
                ? config.headers.get('Authorization') 
                : (config.headers as any)['Authorization'];
            console.log(`🔑 [Request Interceptor] Attached Header: ${attachedHeader ? attachedHeader.substring(0, 20) : 'NONE'}...`);
        } else {
            console.log(`🔑 [Request Interceptor] Warning: No token found to attach!`);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const errorCode = error.response?.data?.code;
        const errorMessage = error.response?.data?.message;
        const requestUrl = error.config?.url;

        console.log(`⚠️ Request to ${requestUrl} failed with status ${status}, code ${errorCode}, message: "${errorMessage}"`);

        // Handle concurrent login session revocation
        if (errorCode === 'SESSION_REVOKED') {
            useAuthStore.getState().setSessionRevoked(true);
            return Promise.reject(error);
        }

        // Handle forced logouts
        if (status === 401 || status === 403 || errorCode === 'ACCOUNT_LOCKED') {
            useAuthStore.getState().logout();
            router.replace('/login' as any);
        }

        return Promise.reject(error);
    }
);

export default axiosClient;