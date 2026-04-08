function FastAttackFruit()
    if getgenv().IsUsingFastAttack then return end
    
    local char = player.Character
    local tool = char and char:FindFirstChildOfClass("Tool")
    
    if tool and tool.ToolTip == "Blox Fruit" and HasM1Fruit() then
        getgenv().IsUsingFastAttack = true
        
        for i = 1, getgenv().AutoBounty.Combat.FastAttackSpeed or 12 do
            task.spawn(function()
                pcall(function()
                    tool:Activate()
                    
                    local remote = tool:FindFirstChild("LeftClickRemote") or tool:FindFirstChild("Remote")
                    if remote then
                        remote:FireServer(Vector3.new(0,0,0), 1)
                    end
                    
                    Net:InvokeServer("Attack", {
                        [1] = getgenv().targ and getgenv().targ.Character and getgenv().targ.Character:FindFirstChild("HumanoidRootPart")
                    })
                end)
            end)
            
            task.wait(0.01) 
        end
        
        getgenv().IsUsingFastAttack = false
    end
end
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
