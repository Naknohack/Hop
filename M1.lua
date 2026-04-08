local p=game.Players.LocalPlayer
local rs=game.ReplicatedStorage
local Net=rs.Modules.Net
cục bộ RH,RA=Net["RE/RegisterHit"],Net["RE/RegisterAttack"]

local SendHit
pcall(function()
    SendHit=getsenv(p.PlayerScripts:WaitForChildOfClass("LocalScript"))._G.SendHitsToServer
kết thúc)

cục bộ R=999
local Parts={"Head","HumanoidRootPart","LeftHand","RightHand","LeftLowerArm","RightLowerArm"}

hàm cục bộ ngu(v)
    local h=v:FindFirstChild("Humanoid")
    local r=v:FindFirstChild("HumanoidRootPart")
    trả về h và r và h.Health>0
kết thúc

hàm cục bộ trieu()
    cục bộ t,c={},p.Ký tự
    nếu không phải c thì trả về t kết thúc
    local hrp=c.HumanoidRootPart
    
    for _,v in pairs(workspace.Enemies:GetChildren()) do
        nếu ngu(v) và (v.HumanoidRootPart.Position-hrp.Position).Magnitude<=R thì
            t[#t+1]=v
        kết thúc
    kết thúc
    for _,v in pairs(workspace.Characters:GetChildren()) do
        nếu v~=c và ngu(v) và (v.HumanoidRootPart.Position-hrp.Position).Magnitude<=R thì
            t[#t+1]=v
        kết thúc
    kết thúc
    trả lại t
kết thúc

hàm cục bộ hh(v)
    return v:FindFirstChild(Parts[math.random(#Parts)]) or v.HumanoidRootPart
kết thúc

task.spawn(function()
    trong khi task.wait() thực hiện
        local c=p.Character
        nếu không phải c thì tiếp tục kết thúc
        
        cục bộ tg=trieu()
        nếu #tg==0 thì tiếp tục kết thúc
        
        cục bộ a={nil,{}}
        for _,v in pairs(tg) do
            cục bộ pr=hh(v)
            a[1]=a[1] hoặc pr
            a[2][#a[2]+1]={v,pr}
        kết thúc
        
        RA:FireServer(0)
        nếu SendHit thì SendHit(unpack(a)) ngược lại RH:FireServer(unpack(a)) kết thúc
    kết thúc
kết thúc)
cục bộ S=3

thang đo chức năng cục bộ (c)
	for _,v in pairs(c:GetDescendants()) do
		nếu v:IsA("BasePart") thì
			v.Size=v.Size*S
		elseif v:IsA("SpecialMesh") or v:IsA("Mesh") then
			v.Scale=v.Scale*S
		kết thúc
	kết thúc
kết thúc

hàm cục bộ apply()
	local c=workspace.Characters:WaitForChild(p.Name)
	tỷ lệ (c)
kết thúc

áp dụng()

p.CharacterAdded:Connect(function()
	task.wait(1)
	áp dụng()
kết thúc)
-- trieu
