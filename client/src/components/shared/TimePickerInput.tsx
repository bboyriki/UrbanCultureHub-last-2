import React from "react";
import { Input } from "@/components/ui/input";
import { format, parse } from "date-fns";

interface TimePickerInputProps {
  id?: string;
  value?: Date | null;
  onChange: (date: Date) => void;
  disabled?: boolean;
  className?: string;
}

export function TimePickerInput({
  id,
  value,
  onChange,
  disabled = false,
  className = "",
}: TimePickerInputProps) {
  // Format time as HH:MM
  const formattedTime = value ? format(value, "HH:mm") : "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeString = e.target.value;
    
    if (!timeString) return;
    
    // Create a date object from the time string
    try {
      // Use the current date and update the hours and minutes
      const parsedTime = parse(timeString, "HH:mm", new Date());
      
      // Ensure we don't change the current date, only the time
      if (value) {
        parsedTime.setFullYear(value.getFullYear());
        parsedTime.setMonth(value.getMonth());
        parsedTime.setDate(value.getDate());
      }
      
      onChange(parsedTime);
    } catch (error) {
      console.error("Error parsing time:", error);
    }
  };

  return (
    <Input
      id={id}
      type="time"
      value={formattedTime}
      onChange={handleChange}
      disabled={disabled}
      className={className}
    />
  );
}