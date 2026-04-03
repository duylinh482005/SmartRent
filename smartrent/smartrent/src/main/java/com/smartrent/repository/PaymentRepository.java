package com.smartrent.repository;

import com.smartrent.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByTransactionId(String transactionId);
    List<Payment> findByInvoiceId(Long invoiceId);
    long countByInvoiceContractId(Long contractId);
}
