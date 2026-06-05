package com.smartrent.controller;

import com.smartrent.dto.request.ChangePasswordRequest;
import com.smartrent.dto.request.LoginRequest;
import com.smartrent.dto.request.RegisterRequest;
import com.smartrent.dto.request.UpdatePaymentInfoRequest;
import com.smartrent.dto.response.AuthResponse;
import com.smartrent.dto.response.UserProfileResponse;
import com.smartrent.service.AuthService;
import com.smartrent.util.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(authService.register(request)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.success(authService.login(request)));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getCurrentUserProfile() {
        return ResponseEntity.ok(ApiResponse.success(authService.getCurrentUserProfile()));
    }

    @PatchMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PatchMapping("/payment-info")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updatePaymentInfo(
            @RequestBody UpdatePaymentInfoRequest request) {
        return ResponseEntity.ok(ApiResponse.success(authService.updatePaymentInfo(request)));
    }
}
