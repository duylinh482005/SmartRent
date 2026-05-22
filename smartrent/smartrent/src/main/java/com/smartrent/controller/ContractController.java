package com.smartrent.controller;

import com.smartrent.dto.request.ContractRequest;
import com.smartrent.dto.response.ContractResponse;
import com.smartrent.service.ContractService;
import com.smartrent.util.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

import java.util.List;

@RestController
@RequestMapping("/api/v1/contracts")
@RequiredArgsConstructor
public class ContractController {

    private final ContractService contractService;

    @PostMapping
    public ResponseEntity<ApiResponse<ContractResponse>> create(
            @Valid @RequestBody ContractRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(contractService.create(request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ContractResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(contractService.getAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ContractResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(contractService.getById(id)));
    }

    @GetMapping("/room/{roomId}")
    public ResponseEntity<ApiResponse<List<ContractResponse>>> getByRoom(
            @PathVariable Long roomId) {
        return ResponseEntity.ok(ApiResponse.success(contractService.getByRoom(roomId)));
    }

    @GetMapping("/tenant/{tenantId}")
    public ResponseEntity<ApiResponse<List<ContractResponse>>> getByTenant(
            @PathVariable Long tenantId) {
        return ResponseEntity.ok(ApiResponse.success(contractService.getByTenant(tenantId)));
    }

    @PatchMapping("/{id}/terminate")
    public ResponseEntity<ApiResponse<ContractResponse>> terminate(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(contractService.terminate(id)));
    }

    @PatchMapping("/{id}/renew")
    public ResponseEntity<ApiResponse<ContractResponse>> renew(
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate newEndDate) {
        return ResponseEntity.ok(ApiResponse.success(contractService.renew(id, newEndDate)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        contractService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
