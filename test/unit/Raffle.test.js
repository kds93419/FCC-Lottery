const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig} = require("../../helper-hardhat-config");

!developmentChains.includes(network.name) ? describe.skip : describe("Raffle Unit Test!!", async function () {
      //
      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer; //이러면 deployer은 accounts[0]??
        await deployments.fixture(["all"]); //deploy everythins
        raffle = await ethers.getContract("Raffle", deployer);
        console.log(raffle)
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock",deployer);
        raffleEntranceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();
        // raffle.once
      
       
        
        
      });

      describe("constructor", async function () {
        it("initializes the raffle correctly", async function () {
          //Ideally we make our tests have just 1 assert per "it"
          const raffleState = await raffle.getRaffleState();
       
          assert.equal(raffleState.toString(), "0");
          assert.equal(
            interval.toString(),
            networkConfig[chainId]["keepersUpdateInterval"]
          );
        });
      });

      describe("enterRaffle", async function () {
        it("reverts when you don't pay enough", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle_NotEnoughETHEntered"); // yarn hardhat --grep "Raffle만 써도 Raffle unit test가 테스트 되는거 같음"
        });
        it("records players when they enter", async function() {
          await raffle.enterRaffle({value: raffleEntranceFee});
          const playerFromContract = await raffle.getplayer(0);
          assert.equal(playerFromContract, deployer);

          //raffleEntranceFee
        })

        it("emits event on enter", async function(){
          await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.emit(raffle, "RaffleEnter") //raffle은 Raffle 컨트랙트 Raffle.sol 파일에 이벤트 RaffleEnter
        })

        if("doesn't allow entrance when raffle is calculationg", async function() {
          await raffle.enterRaffle({value: raffleEntranceFee});
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          //we pretend to be a chainlink keeper
          await raffle.performUpkeep([])
          await expect(raffle.enterRaffle({value: raffleEntranceFee})).to.be.revertedWith("Raffle_NotOpen");
        });
      });

      describe("checkUpkeep", async function() {
        it("returns false if people haven't sent any ETH", async function() {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1 ]) //임의로 블록타임스탬프 증가시키기위한?
          await network.provider.send("evm_mine", [])
          const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([]) //실제로 트랜잭션(함수호출)하지 않고 시뮬레이팅하고싶을때 callStatic쓴다
          assert(!upkeepNeeded)
        })
        it("returns false if raffle isn't open", async function(){
          await raffle.enterRaffle({value: raffleEntranceFee})
          await network.provider.send("evm_increaseTime",[interval.toNumber() + 1 ] )
          await network.provider.send("evm_mine",[] )
          await raffle.performUpkeep([])
          const raffleState = await raffle.getRaffleState()
          const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
          assert.equal(raffleState.toString(), "1")
          assert.equal(upkeepNeeded, false)
        })
        it("returns false if enough time hasn't passed", async function() {
          await raffle.enterRaffle({value: raffleEntranceFee})
          await network.provider.send("evm_increaseTime",[interval.toNumber() - 1 ] )
          await network.provider.send("evm_mine",[])
          const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([]) //or "0x" []랑 같다
          assert(!upkeepNeeded)
        })
        it("returns true if enough time has passed, has players, eth, and is open", async function() {
          await raffle.enterRaffle({value: raffleEntranceFee})
          await network.provider.send("evm_increaseTime",[interval.toNumber() + 1 ] )
          await network.provider.send("evm_mine",[])
          const {upkeepNeeded} = await raffle.callStatic.checkUpkeep([])
          assert(upkeepNeeded)
        })
      })

      describe("performUpkeep", async function() {
        it("it can only run if checkupkeep is true", async function() {
          await raffle.enterRaffle({value: raffleEntranceFee})
          await network.provider.send("evm_increaseTime",[interval.toNumber() + 1 ] )
          await network.provider.send("evm_mine", [])
          const tx = await raffle.performUpkeep([])
          assert(tx)
        })
        it("reverts when checkupKeep is false", async function() {
          await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle_UpkeepNotNeeded") // ()안에 3개의 인수 넣어도 됨
        })
        it("updates the raffle state, emits and event, and calls the vrf coordinator", async function() {
          await raffle.enterRaffle({value: raffleEntranceFee})
          await network.provider.send("evm_increaseTime",[interval.toNumber() + 1 ] )
          await network.provider.send("evm_mine", [])
          const txResponse = await raffle.performUpkeep([])
          const txReciept = await txResponse.wait(1) // 1 block
          const requestId = txReciept.events[1].args.requestId //1인이유가  emit RequestedRaffleWinner(requestID) 먼저 실행되서?? 15:48:10
          const raffleState = await raffle.getRaffleState()
          assert(requestId.toNumber() > 0) //Raffle.sol에서 event에 performUpkeep에서 uint256 RequestID ID 대문자여서  TypeError: Cannot read properties of undefined (reading 'toNumber')에러떳었음
          assert(raffleState.toString() == "1")
        })
      })
      describe("fulfillRandomWords", function() {
        beforeEach(async function() {
          await raffle.enterRaffle({value: raffleEntranceFee})
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
        })
        it("can only be called after performupkeep", async function() { //can only be called after performUpkeep U대문자로하니까 에러뜸 이유는 모르겠음
          await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
          await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
        })
      })

      it("picks a winner, resets the lottery, and sends money", async function() {
        const additionalEntrants = 3
        const startingAccountindex = 1 //deployer = 0 
        const accounts = await ethers.getSigners()
        for(let i = startingAccountindex; i< startingAccountindex + additionalEntrants; i++){
          const accountConnectedRaffle = raffle.connect(accounts[i])
          await accountConnectedRaffle.enterRaffle({value: raffleEntranceFee})
        }
        const startingTimeStamp = await raffle.getLatestTimeStamp()

        //performUpkeep (mock being chainlink keepers)
        //fulfillRandomWords (mock being the chainlink VRF)
        //We will have to wait for the fulfillRandomWords to be called
        await new Promise(async function(resolve, reject) {   //config파일에서 mocha 타임아웃 10초이후까지 반응없으면 실패발생
          raffle.once("WinnerPicked", async () => {
            console.log("found eth event!")
            try{
              const recentWinner = await raffle.getRecentWinner()
              const raffleState = await raffle.getRaffleState()
              const endingTimeStamp = await raffle.getLatestTimeStamp()
              const numPlayers = await raffle.getNumberOfPlayers()
              console.log(recentWinner)
              console.log(accounts[2])
              console.log(accounts[0])
              console.log(accounts[1])
              console.log(accounts[3])
              assert.equal(numPlayers.toString(), "0")
              assert.equal(raffleState.toString(), "0")
              assert(endingTimeStamp > startingTimeStamp)
              resolve();
            } catch (e) {
              reject(e)
            }
            
          })
          //Setting up the listener
          //below, we will fire the event, and the listenr will pick it up, and resolve
          const tx = await raffle.performUpkeep([])
          const txReceipt = await tx.wait(1)
          await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address)
        })
        
      })

    }); //조건 ? A : B; True면 A False면 B
