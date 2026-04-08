local VirtualUser = game:GetService("VirtualUser")
local plr = game.Players.LocalPlayer

-- equip fruit
spawn(function()
    while task.wait(0.5) do
        local char = plr.Character
        local bp = plr:FindFirstChild("Backpack")

        if char and bp then
            for _,v in pairs(bp:GetChildren()) do
                if v:IsA("Tool") and string.find(string.lower(v.Name),"fruit") then
                    if v.Parent ~= char then
                        v.Parent = char
                    end
                end
            end
        end
    end
end)

-- spam m1
function Click()
    VirtualUser:CaptureController()
    VirtualUser:Button1Down(Vector2.new(0,0))
end

spawn(function()
    while task.wait() do
        Click()
    end
end)
