package com.smartrent.repository;

import com.smartrent.entity.Property;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PropertyRepository extends JpaRepository<Property, Long> {
    List<Property> findByOwnerId(Long ownerId);
    boolean existsByNameAndOwnerId(String name, Long ownerId);
    boolean existsByNameAndOwnerIdAndIdNot(String name, Long ownerId, Long id);
}
