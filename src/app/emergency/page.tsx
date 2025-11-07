
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, MessageSquare, Siren, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function EmergencyPage() {
    const router = useRouter();
    const { toast } = useToast();

    const handleShareLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                
                // Attempt to use the Share API
                if (navigator.share) {
                    navigator.share({
                        title: 'My Location for Emergency',
                        text: `I need help. My current location is: ${googleMapsUrl}`,
                        url: googleMapsUrl,
                    }).then(() => {
                        toast({ title: "Location Sent", description: "Your location has been prepared for sharing." });
                    }).catch((error) => {
                        console.error('Share API error:', error);
                        // Fallback for when share fails
                        copyToClipboard(googleMapsUrl);
                    });
                } else {
                    // Fallback for browsers that don't support the Share API
                    copyToClipboard(googleMapsUrl);
                }
            }, (error) => {
                toast({ variant: 'destructive', title: "Location Error", description: "Could not retrieve your location. Please check your browser permissions." });
                console.error("Geolocation error:", error);
            });
        } else {
            toast({ variant: 'destructive', title: "Unsupported", description: "Geolocation is not supported by your browser." });
        }
    };
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: "Location Copied", description: "Your location link has been copied to the clipboard." });
        }).catch(() => {
            toast({ variant: 'destructive', title: "Copy Failed", description: "Could not copy location to clipboard." });
        });
    }

    return (
        <>
        <style jsx global>{`
            .emergency-page-bg {
                background: linear-gradient(135deg, #ff5f6d 0%, #ffc371 100%);
            }
            .dark .emergency-page-bg {
                 background: linear-gradient(135deg, #b22222 0%, #8b0000 100%);
            }
        `}</style>
        <div className="emergency-page-bg min-h-screen flex flex-col items-center justify-center p-4">
            <Button variant="ghost" onClick={() => router.back()} className="absolute top-4 left-4 text-white hover:bg-white/20 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4"/> Go Back
            </Button>
            <Card className="w-full max-w-lg shadow-2xl bg-white/90 backdrop-blur-sm">
                <CardHeader className="text-center">
                    <Siren className="mx-auto h-12 w-12 text-red-500 animate-pulse" />
                    <CardTitle className="text-3xl font-bold text-red-600 mt-2">Emergency Help</CardTitle>
                    <CardDescription>
                        Use the options below for immediate assistance.
                        If you are in a life-threatening situation, call your local emergency number immediately.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <a href="tel:9508303819" className="block">
                            <Button variant="outline" className="w-full justify-start h-14 text-lg">
                                <Phone className="mr-4 h-6 w-6 text-blue-500" />
                                <div>
                                    <p className="font-semibold text-left">Call Help Center</p>
                                    <p className="text-muted-foreground text-sm font-normal">9508303819</p>
                                </div>
                            </Button>
                        </a>
                        <a href="mailto:helpcenter@gmail.com" className="block">
                            <Button variant="outline" className="w-full justify-start h-14 text-lg">
                                <Mail className="mr-4 h-6 w-6 text-gray-500" />
                                 <div>
                                    <p className="font-semibold text-left">Email Support</p>
                                    <p className="text-muted-foreground text-sm font-normal">helpcenter@gmail.com</p>
                                </div>
                            </Button>
                        </a>
                         <Button variant="outline" onClick={handleShareLocation} className="w-full justify-start h-14 text-lg">
                            <MapPin className="mr-4 h-6 w-6 text-green-500" />
                             <div>
                                <p className="font-semibold text-left">Share My Location</p>
                                <p className="text-muted-foreground text-sm font-normal">Send a map link to a contact</p>
                            </div>
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="emergency-details">Describe your emergency:</Label>
                        <Textarea id="emergency-details" placeholder="e.g., 'Severe allergic reaction, difficulty breathing...'" className="min-h-[100px]" />
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                            <MessageSquare className="mr-2 h-4 w-4" /> Send details to 108
                        </Button>
                    </div>

                    <a href="tel:108">
                        <Button size="lg" className="w-full h-16 text-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg">
                            <Siren className="mr-3 h-6 w-6" /> CALL 108 NOW
                        </Button>
                    </a>
                </CardContent>
            </Card>
        </div>
        </>
    );
}
