package com.smartrent.repository;

import com.smartrent.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    Optional<Room> findByIdAndDeletedFalse(Long id);
    List<Room> findByPropertyIdAndDeletedFalse(Long propertyId);
    List<Room> findByPropertyIdAndStatusAndDeletedFalse(Long propertyId, Room.Status status);
    boolean existsByRoomNumberAndPropertyIdAndDeletedFalse(String roomNumber, Long propertyId);
    boolean existsByRoomNumberAndPropertyIdAndIdNotAndDeletedFalse(String roomNumber, Long propertyId, Long id);
    boolean existsByPropertyIdAndStatusAndDeletedFalse(Long propertyId, Room.Status status);

    @Query("SELECT r FROM Room r JOIN FETCH r.property WHERE r.deleted = false")
    List<Room> findAllWithProperty();
}
