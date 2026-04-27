package com.smartrent.service;

import com.smartrent.dto.request.LoginRequest;
import com.smartrent.dto.request.RegisterRequest;
import com.smartrent.dto.request.ChangePasswordRequest;
import com.smartrent.dto.response.AuthResponse;
import com.smartrent.dto.response.UserProfileResponse;

public interface AuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    UserProfileResponse getCurrentUserProfile();
    void changePassword(ChangePasswordRequest request);
}
