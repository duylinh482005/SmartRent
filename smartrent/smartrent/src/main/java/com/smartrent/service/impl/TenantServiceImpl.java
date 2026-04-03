package com.smartrent.service.impl;

import com.smartrent.dto.request.TenantRequest;
import com.smartrent.dto.response.TenantResponse;
import com.smartrent.entity.Tenant;
import com.smartrent.repository.TenantRepository;
import com.smartrent.service.TenantService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class TenantServiceImpl implements TenantService {

    private final TenantRepository tenantRepository;

    @Override
    public TenantResponse create(TenantRequest request) {
        if (tenantRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("Số điện thoại '" + request.getPhone() + "' đã được đăng ký");
        }
        if (request.getIdCardNumber() != null
                && tenantRepository.existsByIdCardNumber(request.getIdCardNumber())) {
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
        return tenantRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public TenantResponse update(Long id, TenantRequest request) {
        Tenant tenant = findById(id);

        // Kiểm tra phone trùng với người khác
        tenantRepository.findByPhone(request.getPhone()).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new RuntimeException("Số điện thoại '" + request.getPhone() + "' đã được dùng");
            }
        });

        tenant.setFullName(request.getFullName());
        tenant.setPhone(request.getPhone());
        tenant.setEmail(request.getEmail());
        tenant.setIdCardNumber(request.getIdCardNumber());

        return toResponse(tenantRepository.save(tenant));
    }

    @Override
    public void delete(Long id) {
        tenantRepository.delete(findById(id));
    }

    private Tenant findById(Long id) {
        return tenantRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khách thuê id: " + id));
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