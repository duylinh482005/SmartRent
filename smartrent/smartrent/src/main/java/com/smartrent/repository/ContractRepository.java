package com.smartrent.repository;

import com.smartrent.entity.Contract;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContractRepository extends JpaRepository<Contract, Long> {
    Optional<Contract> findByIdAndDeletedFalse(Long id);
    List<Contract> findByDeletedFalse();
    List<Contract> findByRoomIdAndDeletedFalse(Long roomId);
    List<Contract> findByTenantIdAndDeletedFalse(Long tenantId);
    Optional<Contract> findByRoomIdAndStatusAndDeletedFalse(Long roomId, Contract.Status status);

    @Query("""
        SELECT c FROM Contract c
        JOIN FETCH c.room r
        JOIN FETCH c.tenant t
        WHERE c.status = :status AND c.deleted = false
    """)
    List<Contract> findAllActiveWithDetails(Contract.Status status);
}
