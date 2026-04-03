package com.smartrent.controller;

import com.smartrent.dto.request.TenantRequest;
import com.smartrent.dto.response.TenantResponse;
import com.smartrent.service.TenantService;
import com.smartrent.util.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/tenants")
@RequiredArgsConstructor
public class TenantController {

    private final TenantService tenantService;

    @PostMapping
    public ResponseEntity<ApiResponse<TenantResponse>> create(
            @Valid @RequestBody TenantRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(tenantService.create(request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<TenantResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(tenantService.getAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TenantResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.getById(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TenantResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody TenantRequest request) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        tenantService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}