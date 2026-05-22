package com.smartrent.repository;

import com.smartrent.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, Long> {
    List<Tenant> findByDeletedFalse();
    Optional<Tenant> findByIdAndDeletedFalse(Long id);
    Optional<Tenant> findByPhone(String phone);
    Optional<Tenant> findByPhoneAndDeletedFalse(String phone);
    boolean existsByPhone(String phone);
    boolean existsByIdCardNumber(String idCardNumber);
}
