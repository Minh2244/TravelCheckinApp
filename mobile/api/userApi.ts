import axiosClient from './axiosClient';
import { ApiResponse } from '../types';

const userApi = {
  getCheckins: async (): Promise<ApiResponse> => {
    const response = await axiosClient.get('/user/checkins');
    return response.data;
  },
  getFavorites: async (): Promise<ApiResponse> => {
    const response = await axiosClient.get('/user/favorites');
    return response.data;
  },
  getMySavedVouchers: async (): Promise<ApiResponse> => {
    const response = await axiosClient.get('/user/vouchers/saved');
    return response.data;
  },
};

export default userApi;
