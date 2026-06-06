package com.smartrent.repository;

import com.smartrent.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    Optional<Expense> findByIdAndDeletedFalse(Long id);

    List<Expense> findByDeletedFalse();

    List<Expense> findByPropertyIdAndDeletedFalse(Long propertyId);

    List<Expense> findByPropertyIdAndExpenseDateBetweenAndDeletedFalse(
            Long propertyId, LocalDate from, LocalDate to);

    List<Expense> findByExpenseDateBetweenAndDeletedFalse(LocalDate from, LocalDate to);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e " +
           "WHERE e.property.id = :propertyId AND e.expenseDate BETWEEN :from AND :to AND e.deleted = false")
    BigDecimal sumByPropertyIdAndDateRange(
            @Param("propertyId") Long propertyId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}
