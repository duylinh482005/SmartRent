package com.smartrent.repository;

import com.smartrent.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findByIdAndDeletedFalse(Long id);

    List<Invoice> findByDeletedFalse();

    List<Invoice> findByContractIdAndDeletedFalse(Long contractId);

    long countByContractId(Long contractId);

    List<Invoice> findByStatusAndDeletedFalse(Invoice.Status status);

    boolean existsByContractIdAndBillingMonthAndDeletedFalse(Long contractId, LocalDate billingMonth);
    boolean existsByContractIdAndStatusAndDeletedFalse(Long contractId, Invoice.Status status);
    boolean existsByContractRoomIdAndStatusAndDeletedFalse(Long roomId, Invoice.Status status);

    @Query("""
        SELECT COUNT(i) > 0 FROM Invoice i
        WHERE i.contract.room.property.id = :propertyId
          AND i.status = 'PAID'
          AND i.deleted = false
    """)
    boolean existsPaidInvoiceByPropertyId(@Param("propertyId") Long propertyId);

    Optional<Invoice> findTopByContractIdAndBillingMonthLessThanAndDeletedFalseOrderByBillingMonthDesc(Long contractId, LocalDate billingMonth);

    List<Invoice> findByContractIdAndStatusAndDeletedFalse(Long contractId, Invoice.Status status);

    @Query("""
        SELECT i FROM Invoice i
        JOIN FETCH i.contract c
        JOIN FETCH c.room r
        JOIN FETCH r.property p
        JOIN FETCH c.tenant t
        WHERE i.status = :status
          AND i.deleted = false
    """)
    List<Invoice> findAllByStatusWithDetails(@Param("status") Invoice.Status status);

    @Query("""
        SELECT COALESCE(SUM(i.totalAmount), 0) FROM Invoice i
        WHERE i.status = 'PAID'
          AND i.deleted = false
          AND i.billingMonth >= :from AND i.billingMonth <= :to
    """)
    java.math.BigDecimal sumPaidInRange(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("""
        SELECT COALESCE(SUM(i.totalAmount), 0) FROM Invoice i
        WHERE i.contract.id = :contractId
          AND i.status <> 'PAID'
          AND i.deleted = false
    """)
    java.math.BigDecimal sumOutstandingByContractId(@Param("contractId") Long contractId);

    @Query("""
        SELECT i FROM Invoice i
        JOIN FETCH i.contract c
        JOIN FETCH c.room r
        JOIN FETCH r.property p
        JOIN FETCH c.tenant t
        WHERE i.deleted = false
          AND i.billingMonth >= :fromMonth
    """)
    List<Invoice> findAllNonDeletedSinceWithDetails(@Param("fromMonth") LocalDate fromMonth);
}
