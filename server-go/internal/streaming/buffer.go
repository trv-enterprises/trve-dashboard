// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package streaming

import (
	"sync"

	"github.com/trv-enterprises/trve-dashboard/internal/models"
)

// RingBuffer is a thread-safe circular buffer for storing records
type RingBuffer struct {
	data     []models.Record
	size     int
	head     int
	count    int
	mu       sync.RWMutex
}

// NewRingBuffer creates a new ring buffer with the specified capacity
func NewRingBuffer(capacity int) *RingBuffer {
	if capacity <= 0 {
		capacity = 100
	}
	return &RingBuffer{
		data: make([]models.Record, capacity),
		size: capacity,
	}
}

// Push adds a record to the buffer, overwriting oldest if full
func (rb *RingBuffer) Push(record models.Record) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	rb.data[rb.head] = record
	rb.head = (rb.head + 1) % rb.size

	if rb.count < rb.size {
		rb.count++
	}
}

// PushMany adds multiple records to the buffer
func (rb *RingBuffer) PushMany(records []models.Record) {
	for _, record := range records {
		rb.Push(record)
	}
}

// GetAll returns all records in chronological order (oldest first)
func (rb *RingBuffer) GetAll() []models.Record {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	if rb.count == 0 {
		return []models.Record{}
	}

	result := make([]models.Record, rb.count)

	// Calculate start position (oldest record)
	start := 0
	if rb.count == rb.size {
		start = rb.head // Buffer is full, head points to oldest
	}

	for i := 0; i < rb.count; i++ {
		idx := (start + i) % rb.size
		result[i] = rb.data[idx]
	}

	return result
}

// GetLast returns the last n records (most recent)
func (rb *RingBuffer) GetLast(n int) []models.Record {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	if rb.count == 0 {
		return []models.Record{}
	}

	if n > rb.count {
		n = rb.count
	}

	result := make([]models.Record, n)

	// Start from most recent and go backwards
	for i := 0; i < n; i++ {
		idx := (rb.head - 1 - i + rb.size) % rb.size
		result[n-1-i] = rb.data[idx] // Reverse order so oldest is first
	}

	return result
}

// Count returns the number of records in the buffer
func (rb *RingBuffer) Count() int {
	rb.mu.RLock()
	defer rb.mu.RUnlock()
	return rb.count
}

// Clear removes all records from the buffer
func (rb *RingBuffer) Clear() {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	rb.head = 0
	rb.count = 0
}

// Capacity returns the maximum capacity of the buffer
func (rb *RingBuffer) Capacity() int {
	return rb.size
}
