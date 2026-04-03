package com.smartrent.service;

import com.smartrent.dto.request.LoginRequest;
import com.smartrent.dto.request.RegisterRequest;
import com.smartrent.dto.response.AuthResponse;

public interface AuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
}