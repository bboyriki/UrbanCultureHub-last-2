import { useEffect } from "react";
import { useLocation } from "wouter";

const EventsMapPage = () => {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/map");
  }, []);

  return null;
};

export default EventsMapPage;
