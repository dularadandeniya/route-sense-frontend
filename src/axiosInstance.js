import axios from "axios";
import API_BASE_URL from "./config.js";


const api = axios.create({
    baseURL: API_BASE_URL,
});


api.interceptors.request.use((config) => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
});

export default api;