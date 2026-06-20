import axiosClient from './axiosClient';

const geoApi = {
  reverse: async (lat: number, lng: number) => {
    const response = await axiosClient.get('/geo/reverse', {
      params: { lat, lng },
    });
    return response.data;
  },
};

export default geoApi;
