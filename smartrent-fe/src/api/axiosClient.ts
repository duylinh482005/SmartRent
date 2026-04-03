import axios from 'axios';
import toast from 'react-hot-toast';

const axiosClient = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || 'Có lỗi xảy ra';
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
      toast.error('Phiên đăng nhập hết hạn');
    } else if (error.response?.status === 403) {
      toast.error('Không có quyền truy cập - 403');
    } else {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
