import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function OAuthCallback() {
  // Get query parameters from URL
  const searchParams = new URLSearchParams(window.location.search);
  const { toast } = useToast();
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      const msg = errorDescription || "An error occurred";
      setStatus(`Error: ${msg}`);
      toast({
        title: "Authorization Failed",
        description: msg,
        variant: "destructive",
      });
      return;
    }

    if (!code) {
      setStatus("No authorization code received");
      toast({
        title: "Error",
        description: "No authorization code received from Discord",
        variant: "destructive",
      });
      return;
    }

    // For now, just show success
    setStatus("✅ Bot successfully added to your server!");
    toast({
      title: "Success!",
      description: "Your bot has been added to the Discord server. You can now close this window.",
    });

    // Redirect after 3 seconds
    setTimeout(() => {
      window.location.href = "/";
    }, 3000);
  }, [searchParams, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="mb-4">
          <i className="fas fa-discord text-6xl text-primary"></i>
        </div>
        <h1 className="text-2xl font-bold mb-2">{status}</h1>
        <p className="text-muted-foreground">
          You will be redirected to the home page shortly...
        </p>
      </div>
    </div>
  );
}
