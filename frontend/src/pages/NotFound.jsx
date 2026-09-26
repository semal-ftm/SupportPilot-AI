import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button, EmptyState } from "../components/ui";

export default function NotFound() {
  return (
    <EmptyState
      className="py-24"
      icon={Compass}
      title="Page not found"
      description="This page doesn't exist. Let's get you back home."
      action={
        <Link to="/">
          <Button variant="primary">Go to Home</Button>
        </Link>
      }
    />
  );
}
