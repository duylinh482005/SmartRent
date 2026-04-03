package com.smartrent.repository;

import com.smartrent.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, Long> {
    Optional<Tenant> findByPhone(String phone);
    boolean existsByPhone(String phone);
    boolean existsByIdCardNumber(String idCardNumber);
}