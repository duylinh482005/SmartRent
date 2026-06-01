package com.smartrent.service.impl;

import com.smartrent.dto.request.TenantRequest;
import com.smartrent.dto.response.TenantResponse;
import com.smartrent.entity.Contract;
import com.smartrent.entity.Tenant;
import com.smartrent.repository.ContractRepository;
import com.smartrent.repository.TenantRepository;
import com.smartrent.service.TenantService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class TenantServiceImpl implements TenantService {

    private final TenantRepository tenantRepository;
    private final ContractRepository contractRepository;

    @Override
    public TenantResponse create(TenantRequest request) {
        if (tenantRepository.existsByPhoneAndDeletedFalse(request.getPhone())) {
            throw new RuntimeException("Số điện thoại '" + request.getPhone() + "' đã được đăng ký");
        }
        if (request.getIdCardNumber() != null
                && tenantRepository.existsByIdCardNumberAndDeletedFalse(request.getIdCardNumber())) {
            throw new RuntimeException("CCCD '" + request.getIdCardNumber() + "' đã tồn tại");
        }

        Tenant tenant = Tenant.builder()
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .email(request.getEmail())
                .idCardNumber(request.getIdCardNumber())
                .build();

        return toResponse(tenantRepository.save(tenant));
    }

    @Override
    @Transactional(readOnly = true)
    public TenantResponse getById(Long id) {
        return toResponse(findById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<TenantResponse> getAll() {
        return tenantRepository.findByDeletedFalse().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public TenantResponse update(Long id, TenantRequest request) {
        Tenant tenant = findById(id);

        tenantRepository.findByPhoneAndDeletedFalse(request.getPhone()).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new RuntimeException("Số điện thoại '" + request.getPhone() + "' đã được dùng");
            }
        });

        if (request.getIdCardNumber() != null) {
            tenantRepository.findByIdCardNumberAndDeletedFalse(request.getIdCardNumber()).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new RuntimeException("CCCD '" + request.getIdCardNumber() + "' đã được dùng");
                }
            });
        }

        tenant.setFullName(request.getFullName());
        tenant.setPhone(request.getPhone());
        tenant.setEmail(request.getEmail());
        tenant.setIdCardNumber(request.getIdCardNumber());

        return toResponse(tenantRepository.save(tenant));
    }

    @Override
    public void delete(Long id) {
        Tenant tenant = findById(id);

        if (contractRepository.existsByTenantIdAndStatusAndDeletedFalse(id, Contract.Status.ACTIVE)) {
            throw new RuntimeException(
                    "Không thể xóa khách thuê đang có hợp đồng hiệu lực. Hãy chấm dứt hợp đồng trước.");
        }

        tenant.setDeleted(true);
        tenant.setDeletedAt(LocalDateTime.now());
        tenant.setDeletedBy(getCurrentUsername());
        tenantRepository.save(tenant);
    }

    private Tenant findById(Long id) {
        return tenantRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khách thuê id: " + id));
    }

    private String getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return "system";
        }
        String username = authentication.getName();
        if (username == null || username.isBlank() || "anonymousUser".equalsIgnoreCase(username)) {
            return "system";
        }
        return username;
    }

    private TenantResponse toResponse(Tenant t) {
        return TenantResponse.builder()
                .id(t.getId())
                .fullName(t.getFullName())
                .phone(t.getPhone())
                .email(t.getEmail())
                .idCardNumber(t.getIdCardNumber())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
