package com.smartrent.repository;

import com.smartrent.entity.Property;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PropertyRepository extends JpaRepository<Property, Long> {
    Optional<Property> findByIdAndDeletedFalse(Long id);
    List<Property> findByDeletedFalse();
    List<Property> findByOwnerIdAndDeletedFalse(Long ownerId);
    boolean existsByNameAndOwnerIdAndDeletedFalse(String name, Long ownerId);
    boolean existsByNameAndOwnerIdAndIdNotAndDeletedFalse(String name, Long ownerId, Long id);
}
